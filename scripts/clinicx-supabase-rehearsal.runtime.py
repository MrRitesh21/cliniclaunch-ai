#!/usr/bin/env python3
"""Capture a bounded retry of ONLY this rehearsal's interrupted QA VM start.
Refuses any existing QA VM or a mismatched ownership/snapshot record. Stops only
clinicx-qa. This is diagnostic runtime startup, NOT database verification.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import time


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--work', type=Path, required=True)
    a = p.parse_args()
    module_path = Path(__file__).with_name('clinicx-supabase-rehearsal.py')
    spec = importlib.util.spec_from_file_location('rehearsal', module_path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    w = a.work.resolve()
    if w.parent != m.SCRATCH or not w.name.startswith('clinicx-supabase-'):
        raise SystemExit('Not an owned QA scratch directory')
    report_path = w/'report.json'; report = json.loads(report_path.read_text())
    if report['work'] != str(w) or report['migrations']:
        raise SystemExit('Ownership or fresh-only assertion failed')
    env = m.clean_env('/Users/ritesh', w/'docker-config')
    qa = Path('/Users/ritesh/.colima/clinicx-qa/colima.yaml')
    if not qa.exists() or str(w)+':w' not in qa.read_text() and str(w) not in qa.read_text():
        raise SystemExit('QA profile configuration ownership mismatch')
    # No reuse of a created VM, only the interrupted configuration-only start.
    if Path('/Users/ritesh/.colima/_lima/colima-clinicx-qa').exists():
        raise SystemExit('QA VM already exists; refusing retry')
    command = ['colima','start','--profile','clinicx-qa','--activate=false','--ssh-config=false',
               '--template=false','--runtime','docker','--cpus','2','--memory','4','--disk','20',
               '--mount',str(w)+':w','--verbose']
    log = w/'runtime-retry.log'
    started = time.monotonic()
    record = {'argv':command, 'timeout_seconds':150,'log':str(log),'purpose':'retry interrupted owned configuration-only start'}
    report['commands'].append(record); report_path.write_text(json.dumps(report,indent=2))
    with log.open('w') as f:
        process = subprocess.Popen(command,cwd=w/'project',env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
        try:
            record['exit'] = process.wait(timeout=150)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid,signal.SIGTERM)
            try: process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid,signal.SIGKILL); process.wait(timeout=10)
            record.update(exit=124,timed_out=True)
    record['duration_seconds'] = round(time.monotonic()-started,3)
    report['blocker'] = 'Dedicated Colima runtime startup exit '+str(record['exit'])+'; inspect '+str(log)
    cleanup_log = w/'runtime-cleanup.log'
    with cleanup_log.open('w') as f:
        try:
            cleanup = subprocess.run(['colima','stop','--profile','clinicx-qa'],cwd=w,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=45)
            report['cleanup'] = {'exit':cleanup.returncode,'log':str(cleanup_log)}
        except subprocess.TimeoutExpired:
            report['cleanup'] = {'exit':124,'log':str(cleanup_log)}
    after = subprocess.run(['colima','list','--json'],env=env,capture_output=True,text=True,timeout=30)
    report['colima_after'] = after.stdout
    report['committed'] = 0; report['attempted'] = 0
    report['source_changes_after_freeze'] = [x['file'] for x in report['migration_files']
        if m.hashlib.sha256((m.ROOT/'supabase/migrations'/x['file']).read_bytes()).hexdigest()!=x['sha256']]
    report_path.write_text(json.dumps(report,indent=2))
    print(json.dumps({'report':str(report_path),'runtime_exit':record['exit'],'colima_after':after.stdout},indent=2))
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
