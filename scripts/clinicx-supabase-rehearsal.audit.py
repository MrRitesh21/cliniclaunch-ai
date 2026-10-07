#!/usr/bin/env python3
"""Read-only native fallback availability and QA ownership/environment audit.
These checks do not stand in for Supabase, migrations, or browser E2E.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, required=True)
    work = parser.parse_args().work.resolve()
    spec = importlib.util.spec_from_file_location('qa', Path(__file__).with_name('clinicx-supabase-rehearsal.py'))
    qa = importlib.util.module_from_spec(spec); spec.loader.exec_module(qa)
    if work.parent != qa.SCRATCH or not work.name.startswith('clinicx-supabase-'):
        raise SystemExit('Not owned scratch')
    report_file = work/'report.json'; report = json.loads(report_file.read_text())
    env = qa.clean_env(work/'home', work/'docker-config')
    tests = []
    # Deliberately poisoned ambient values must never reach a child environment.
    os.environ['DATABASE_URL'] = 'canary-not-a-dsn'
    os.environ['SUPABASE_ACCESS_TOKEN'] = 'canary-not-a-secret'
    os.environ['NODE_OPTIONS'] = '--canary'
    clean = qa.clean_env(work/'home', work/'docker-config')
    tests.append({'name':'secret/DSN/NODE_OPTIONS environment isolation', 'pass':all(k not in clean for k in ['DATABASE_URL','SUPABASE_ACCESS_TOKEN','NODE_OPTIONS'])})
    tests.append({'name':'dedicated Docker endpoint only', 'pass':clean['DOCKER_HOST']=='unix:///Users/ritesh/.colima/clinicx-qa/docker.sock'})
    tests.append({'name':'isolated Docker credentials/context directory', 'pass':Path(clean['DOCKER_CONFIG']).parent==work})
    tests.append({'name':'frozen snapshot hashes', 'pass':all(hashlib.sha256((work/'frozen/migrations'/r['file']).read_bytes()).hexdigest()==r['sha256'] for r in report['migration_files'])})
    pg = '/opt/homebrew/opt/postgresql@17/bin/pg_config'
    commands = [[pg,'--sharedir'],['brew','info','--json=v2','pg_cron'],['colima','list','--json']]
    outputs = []
    for i, cmd in enumerate(commands):
        e = dict(env, HOMEBREW_NO_AUTO_UPDATE='1')
        if cmd[0]=='colima': e['HOME']='/Users/ritesh'
        result = subprocess.run(cmd,env=e,cwd=work,capture_output=True,text=True,timeout=60)
        log = work/('availability-%d.log'%i); log.write_text(result.stdout+result.stderr)
        outputs.append({'argv':cmd,'exit':result.returncode,'log':str(log)})
        if i==0:
            shared = Path(result.stdout.strip())
            report['native_pg_cron_control_present'] = (shared/'extension/pg_cron.control').exists()
            report['native_pg_sharedir'] = str(shared)
        if i==1 and result.returncode==0:
            formula = json.loads(result.stdout)['formulae'][0]
            report['native_pg_cron_package_availability'] = {'version':formula['versions']['stable'],'installed':formula['installed'],
                'bottle_platforms':sorted(formula['bottle']['stable']['files']), 'source_url':formula['urls']['stable']['url']}
    report['native_fallback_commands'] = outputs
    report['audit_checks'] = tests
    frozen_names = {r['file'] for r in report['migration_files']}
    report['new_migrations_after_freeze'] = sorted(p.name for p in (qa.ROOT/'supabase/migrations').glob('*.sql') if p.name not in frozen_names)
    report['source_changes_after_freeze'] = sorted(r['file'] for r in report['migration_files']
        if hashlib.sha256((qa.ROOT/'supabase/migrations'/r['file']).read_bytes()).hexdigest()!=r['sha256'])
    report['initial_attempt_interrupted'] = {'outer_tool_timeout_seconds':420,
        'command':['colima','start','--profile','clinicx-qa','--activate=false','--ssh-config=false','--template=false','--runtime','docker','--cpus','2','--memory','4','--disk','20','--mount',str(work)+':w'],
        'log_retained':False,'note':'Initial capture was interrupted by outer terminal tool; do not infer a VM or DB success.'}
    report['blocker_detail'] = 'Bounded dedicated VM retry remained at downloading disk image until timeout exit124; no QA VM, container daemon, Auth or database was started.'
    report['boundary'] = 'attempted actual isolated local Supabase; infrastructure blocked before any database/service verification'
    report_file.write_text(json.dumps(report,indent=2))
    print(json.dumps({'report':str(report_file),'audit_checks':tests,'native_pg_cron_control_present':report['native_pg_cron_control_present'],
                      'native_package':report.get('native_pg_cron_package_availability'),
                      'new_migrations_after_freeze':report['new_migrations_after_freeze'],'source_changes_after_freeze':report['source_changes_after_freeze']},indent=2))
    return 0 if all(t['pass'] for t in tests) and all(c['exit']==0 for c in outputs) else 1


if __name__ == '__main__':
    raise SystemExit(main())
