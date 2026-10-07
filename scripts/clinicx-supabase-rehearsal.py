#!/usr/bin/env python3
"""Dedicated, bounded local Supabase QA; no linked project or ambient DSN.

Run only with --attempt. Creates an immutable migration snapshot under active
profile scratch, a QA-only Colima profile, an internal container network, and
an unlinked Supabase project. Never changes the user's active Docker context.
Exit nonzero if migration/verification gates are incomplete. No provider calls.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
SCRATCH = Path('/Users/ritesh/.hermes/profiles/sara/cache/scratch')
PROFILE = 'clinicx-qa'
EXCLUDE = 'analytics,edge-runtime,functions,imgproxy,inbucket,meta,realtime,studio,vector'


def clean_env(home, docker_config):
    return {'PATH': '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/Users/ritesh/.local/bin',
            'HOME': str(home), 'TMPDIR': str(SCRATCH), 'LC_ALL': 'C',
            'DOCKER_CONFIG': str(docker_config), 'SUPABASE_TELEMETRY_DISABLED': 'true',
            'DOCKER_HOST': 'unix:///Users/ritesh/.colima/clinicx-qa/docker.sock'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--attempt', action='store_true', help='Start only a new dedicated clinicx-qa profile, then clean it up')
    args = parser.parse_args()
    if not args.attempt:
        parser.print_help()
        return 2
    work = SCRATCH / ('clinicx-supabase-' + time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8])
    work.mkdir(mode=0o700)
    home = work / 'home'; home.mkdir(mode=0o700)
    dc = work / 'docker-config'; dc.mkdir(mode=0o700)
    project = work / 'project'; project.mkdir()
    frozen = work / 'frozen' / 'migrations'; frozen.mkdir(parents=True)
    env = clean_env(home, dc)
    # Colima locates the dedicated VM in the real home, without inheriting any
    # environment secrets. Docker credentials and contexts remain scratch-only.
    runtime_env = dict(env, HOME='/Users/ritesh')
    records = []
    report = {'work': str(work), 'boundary': 'actual isolated local Supabase, not hosted/provider/production certification',
              'commands': records, 'migration_files': [], 'migrations': [], 'checks': [],
              'complete': False, 'scenario_A_E': 'PENDING: requires complete migration and real app browser chains'}
    report_path = work / 'report.json'
    def save():
        report_path.write_text(json.dumps(report, indent=2))
    def run(cmd, timeout=60, runtime=False, stdin=None, sensitive=False):
        started = time.monotonic()
        n = len(records)
        log = work / ('command-%03d.log' % n)
        item = {'argv': list(map(str, cmd)), 'cwd': str(project), 'timeout_seconds': timeout, 'log': str(log)}
        records.append(item)
        save()  # Persist the attempted command even if the outer tool is interrupted.
        try:
            if stdin is None and not sensitive:
                with log.open('w') as output_file:
                    child = subprocess.Popen(cmd, cwd=project, env=runtime_env if runtime else env,
                                             stdout=output_file, stderr=subprocess.STDOUT, text=True, start_new_session=True)
                    try:
                        code = child.wait(timeout=timeout)
                    except subprocess.TimeoutExpired:
                        os.killpg(child.pid, signal.SIGTERM)
                        try:
                            child.wait(timeout=10)
                        except subprocess.TimeoutExpired:
                            os.killpg(child.pid, signal.SIGKILL); child.wait(timeout=10)
                        raise
                p = subprocess.CompletedProcess(cmd, code, log.read_text(), '')
            else:
                p = subprocess.run(cmd, cwd=project, env=runtime_env if runtime else env,
                                   input=stdin, capture_output=True, text=True, timeout=timeout)
                log.write_text('[sensitive local keys withheld]\n' if sensitive else p.stdout + p.stderr)
            item.update(exit=p.returncode, duration_seconds=round(time.monotonic()-started, 3))
            save()
            return p
        except subprocess.TimeoutExpired as e:
            out = e.stdout or b''; err = e.stderr or b''
            output = (out.decode(errors='replace') if isinstance(out, bytes) else out) + (err.decode(errors='replace') if isinstance(err, bytes) else err)
            if sensitive:
                log.write_text('[sensitive local keys withheld on timeout]\n')
            elif output:
                with log.open('a') as f:
                    f.write(output)
            item.update(exit=124, duration_seconds=round(time.monotonic()-started, 3), timed_out=True)
            save()
            raise RuntimeError('Bounded command timed out: ' + ' '.join(cmd))
    def checked(cmd, **kw):
        p = run(cmd, **kw)
        if p.returncode:
            raise RuntimeError('Command exit %d: %s; see %s' % (p.returncode, ' '.join(cmd), records[-1]['log']))
        return p
    created = False
    network = 'clinicx-qa-' + uuid.uuid4().hex[:8]
    local_id = network
    try:
        report['git_head'] = checked(['git', '-C', str(ROOT), 'rev-parse', 'HEAD']).stdout.strip()
        report['git_dirty'] = checked(['git', '-C', str(ROOT), 'status', '--short']).stdout
        for path in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
            data = path.read_bytes(); dest = frozen / path.name; dest.write_bytes(data); dest.chmod(0o400)
            report['migration_files'].append({'file': path.name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
        report['migration_file_count'] = len(report['migration_files'])
        report['baseline'] = 'immutable dirty-tree snapshot; later parent-wave edits are not included'
        save()
        before = checked(['colima', 'list', '--json'], runtime=True).stdout
        report['colima_before'] = before
        # Refuse to reuse even a stopped existing QA VM: freshness is mandatory.
        if re.search(r'"(?:name|profile)"\s*:\s*"clinicx-qa"', before) or '"clinicx-qa"' in before:
            raise RuntimeError('clinicx-qa already exists; refusing to reuse or delete it')
        if Path('/Users/ritesh/.colima/clinicx-qa').exists():
            raise RuntimeError('clinicx-qa profile directory already exists; refusing to reuse it')
        report['isolated_context_before'] = checked(['docker', 'context', 'show'], runtime=True).stdout.strip()
        created = True
        checked(['colima', 'start', '--profile', PROFILE, '--activate=false', '--ssh-config=false',
                 '--template=false', '--runtime', 'docker', '--cpus', '2', '--memory', '4',
                 '--disk', '20', '--mount', str(work)+':w'], timeout=150, runtime=True)
        containers = checked(['docker', 'ps', '-aq']).stdout.strip()
        volumes = checked(['docker', 'volume', 'ls', '-q']).stdout.strip()
        report['fresh_runtime'] = {'containers': containers, 'volumes': volumes}
        if containers or volumes:
            raise RuntimeError('Dedicated runtime is not empty; refusing destructive historical SQL')
        checked(['docker', 'network', 'create', '--internal', '--label', 'clinicx.qa=' + local_id, network])
        report['network'] = json.loads(checked(['docker', 'network', 'inspect', network]).stdout)
        if not report['network'][0]['Internal']:
            raise RuntimeError('Internal-only network assertion failed')
        checked(['supabase', 'init', '--workdir', str(project)], timeout=60)
        config = project / 'supabase/config.toml'
        text = config.read_text()
        text = re.sub(r'^project_id\s*=.*$', 'project_id = "'+local_id+'"', text, flags=re.M)
        # Unique non-default ports; no copied hosted reference, config, env, or seed.
        for old, new in [(54321, 57421), (54322, 57422), (54323, 57423), (54324, 57424), (54327, 57427), (54328, 57428)]:
            text = re.sub(r'\b'+str(old)+r'\b', str(new), text)
        text = text.replace('enable_confirmations = true', 'enable_confirmations = false')
        config.write_text(text)
        checked(['supabase', 'start', '--workdir', str(project), '--network-id', network, '--exclude', EXCLUDE], timeout=360, sensitive=True)
        db = 'supabase_db_' + local_id
        inventory = checked(['docker', 'exec', db, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-c',
                             "SELECT count(*) FROM pg_tables WHERE schemaname='public'; SELECT count(*) FROM auth.users; SELECT name FROM pg_available_extensions WHERE name IN ('pg_cron','pg_net','pgcrypto','supabase_vault') ORDER BY 1;"])
        report['fresh_database_inventory'] = inventory.stdout
        values = inventory.stdout.strip().splitlines()
        if values[:2] != ['0', '0']:
            raise RuntimeError('Supabase database is not a fresh empty application/auth database')
        report['destructive_history_authorized_boundary'] = 'new dedicated runtime, no prior volumes/containers, zero public tables/auth users; synthetic only'
        for m in report['migration_files']:
            data = (frozen/m['file']).read_text()
            p = run(['docker', 'exec', '-i', db, 'psql', '-X', '-U', 'postgres', '-d', 'postgres',
                     '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '--single-transaction'], timeout=120, stdin=data)
            match = re.search(r'ERROR:\s+([A-Z0-9]{5}):\s*(.*)', p.stderr)
            report['migrations'].append(dict(m, committed=p.returncode == 0, exit=p.returncode,
                log=records[-1]['log'], sqlstate=match.group(1) if match else None,
                error=match.group(2) if match else None))
            save()
            if p.returncode:
                report['blocker'] = 'Full chronology stopped at ' + m['file'] + ': ' + p.stderr[-2000:]
                break
        report['committed'] = sum(m['committed'] for m in report['migrations'])
        report['attempted'] = len(report['migrations'])
        report['full_history_complete'] = report['committed'] == report['migration_file_count']
        # Real local Auth smoke, independent of migration success; never log tokens.
        status = json.loads(checked(['supabase', 'status', '--workdir', str(project), '-o', 'json'], sensitive=True).stdout)
        api = status.get('API_URL') or status.get('api_url')
        anon = status.get('ANON_KEY') or status.get('anon_key')
        if not api or not anon or not re.match(r'^http://(?:127\.0\.0\.1|localhost):57421$', api):
            raise RuntimeError('Could not obtain safe loopback local API settings')
        def http(method, path, payload=None, token=None):
            body = json.dumps(payload).encode() if payload is not None else None
            req = urllib.request.Request(api+path, body, {'apikey': anon, 'Content-Type': 'application/json',
                **({'Authorization': 'Bearer '+token} if token else {})}, method=method)
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return r.status, json.loads(r.read() or b'{}')
            except urllib.error.HTTPError as e:
                return e.code, json.loads(e.read() or b'{}')
        for label in ['a', 'b']:
            code, result = http('POST', '/auth/v1/signup', {'email': 'qa-'+label+'-'+uuid.uuid4().hex+'@example.invalid',
                                                          'password': uuid.uuid4().hex+'QA!9'})
            token = result.get('access_token')
            report['checks'].append({'name': 'real Auth signup '+label, 'status': code, 'pass': code == 200 and bool(token),
                                     'error': result.get('msg') or result.get('message')})
            if token:
                user_code, user = http('GET', '/auth/v1/user', token=token)
                report['checks'].append({'name': 'real Auth token user readback '+label, 'status': user_code,
                                         'pass': user_code == 200 and user.get('id') == result.get('user', {}).get('id')})
        code, response = http('GET', '/auth/v1/user', token='invalid-local-token')
        report['checks'].append({'name': 'invalid Auth token denied', 'status': code, 'pass': code in [401, 403]})
        report['complete'] = False
        if report['full_history_complete']:
            report['blocker'] = 'Full chronology succeeded; application browser/Auth/RLS A-E still require independent execution'
    except Exception as e:
        report.setdefault('blocker', str(e))
    finally:
        # Stop only our dedicated profile; retain failed VM state and all evidence.
        if created:
            try:
                run(['colima', 'stop', '--profile', PROFILE], timeout=90, runtime=True)
                report['colima_after'] = run(['colima', 'list', '--json'], runtime=True).stdout
            except Exception as e:
                report['cleanup_error'] = str(e)
        report['source_changes_after_freeze'] = [m['file'] for m in report['migration_files']
            if not (ROOT/'supabase/migrations'/m['file']).exists() or
               hashlib.sha256((ROOT/'supabase/migrations'/m['file']).read_bytes()).hexdigest() != m['sha256']]
        report['new_migrations_after_freeze'] = sorted(p.name for p in (ROOT/'supabase/migrations').glob('*.sql')
            if p.name not in {m['file'] for m in report['migration_files']})
        save()
        print(json.dumps({'report': str(report_path), 'blocker': report.get('blocker'),
                          'committed': report.get('committed', 0), 'frozen_files': report['migration_file_count'],
                          'complete': report['complete']}, indent=2))
    return 0 if report['complete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
