#!/usr/bin/env python3
"""Offline dirty-worktree snapshot QA. No production readiness claim or remote env.
Run --help. Each child is bounded; failures and missing gates exit nonzero.
"""
import argparse, datetime, getpass, hashlib, json, os, pathlib, re, shutil
import signal, subprocess, sys, tempfile, time

SCRATCH = pathlib.Path('/Users/ritesh/.hermes/profiles/sara/cache/scratch')
PG = pathlib.Path('/opt/homebrew/opt/postgresql@17/bin')
REVIEWED = {'test-clinicx-admin-authority-integration.cjs': 'c04a1a87e77f3e9a249958ef492af0fe0a01f50ffc2a616b0047102911d0ef56', 'test-clinicx-admin-authority-server.cjs': '9c06d8900fa4d79fa96fc2906ce53e55366aea8709450204918f1b418d940b55', 'test-clinicx-admin-readbacks.cjs': '9bbc5320daba6cbce9c9ae7526e29ece970fe9ada10b2e1417931f4e9c180bc1', 'test-clinicx-admin.cjs': 'f5b20e8a9012920e4fc521f2280f82695825e042ac25a759ac3fb544df641762', 'test-clinicx-billing-recovery-http.cjs': '6fd3023260db8a14d5f2c21a1d838fe37a7e8c4a34d07943879914b1dddf2f71', 'test-clinicx-billing-recovery-integration.cjs': 'f33cd1e42880955cbfaa6db0633fc535b04ce3bca2a6b78c654a646e9dff5ca9', 'test-clinicx-engagement-safety.cjs': 'b9ebb5061943cc70ba5a36344174260536c8f8b25c0a89a4145a506a208516f5', 'test-clinicx-engagement.cjs': 'e0d7b7812ce53b5fe50775bca7df787a023adb714544f3e691fb99b63fa5470b', 'test-clinicx-frontend-integration.cjs': '5c55a31885a4b2558152001f826d7e3087c86d517cae7e3abda5afdf80588e4e', 'test-clinicx-frontend.cjs': 'a33c151abce9939b59c040c1e10b6cfc5d288c5a7c0864bde628c7298ce1478f', 'test-clinicx-payments-integration.cjs': 'bb2327398866d8ea90d84003bfbfb9cc8d8d1d552f68e047a40f6419e13b5568', 'test-clinicx-payments.cjs': '6dbb4b9d6764b32fbfc1888bd094ff65c025990bf3e046d2cb538d6b7004d8d4', 'test-clinicx-recurring-handlers.cjs': '2208360043b4f936b1354d0023adb73dbf5175341a270228f6583ceacb05b8e5', 'test-clinicx-recurring-integration.cjs': '139b7ea7e32acf257dc5eb6b9cce5e555dfb76fb28afc2e3150ed4eb42f5bc90', 'test-clinicx-recurring.cjs': '8d4b924c41faa47eab46083c4befe4aa698c7fa1741400c9f5b8f4141dfe0297', 'test-clinicx-subscription.cjs': '8e935032d6c25905b1a662cdc0a7ba605daf03693e1656c92f838dd8e9588893', 'test-clinicx-admin-authority-db.py': '0d24d1a3a5775ce88233b1ef6ff9d5ef68e10bf43093143bc33447736b737027', 'test-clinicx-admin-db.py': '328859bb2123537b59996416e0524d09ec178cc0921c62e56cce4d024d1d0220', 'test-clinicx-appointment-enum-db.py': 'd4ef3c5a971f31d6f964249868eb369e0f9fad4293def13ceb799cde05261da8', 'test-clinicx-billing-recovery-db.py': 'e250c0c2f488f71235148959adf82e3ee137012c1ca40740df1ccea435cc6345', 'test-clinicx-engagement-db.py': 'cca4a0bd245740646a24b53bae2659cdf0533b5bc2d9a497dac3f477b4597318', 'test-clinicx-engagement-safety-db.py': '473a0bb228b1229ba48439f9bebed841eb8b4786af15519214eb393fa841f5ff', 'test-clinicx-payments-db.py': '659605acf6a3c927a0934357fa9fe58c261ee37fd7f7d98e3a2f23b5bb175596', 'test-clinicx-recurring-db.py': 'a43b4dfc4d986e010328aea2b326d1c15f4494e9387fa6f63e1794897cda0bdd', 'test-clinicx-subscription-db.py': '984d95ad72a53a048b0cfd5822dabb050efcb5ec8425a4407353971901dfd374', 'test-clinicx-typecheck-regressions.mjs': '740689c9d3979b29ed405494897d66096515c8aa61cc02d7d3416a83151c1d2d', 'clinicx-security-handlers.cjs': '5460f71393982253a01284668155e272d1c92b435d66d0a1e96440acbbb06d01', 'clinicx-security-db.py': '2cc5a429a6703d8006dff8ae2b4e8460d63bfd22ee1773f7542fc06f57e58605', 'verify-clinicx-payment-adapter.mjs': 'a917b4402a1e11aa05b9e221c60fa9195c64010b9d65737219e864e455561f93', 'test-clinicx-frontend-browser.mjs': '9caf781943762063ff01bff194e3ac3198144170f7d15101bdc5e11e9344a71d', 'check-auth-guards.mjs': '2f40c4993263e80e20e9e199e364f320a2ad25ffbd55ee1d7094b0652b145f9b'}
REVIEWED_TESTS = {'tests/clinicx-shared-compiler.mjs': '9745a5842cc0abdcddf958408d02ef4dd880d506d17e7749124f6abd55249a16', 'tests/clinicx-release-runner.py': 'b6ef93baba4d7b9c12ac156caf52120612971116346b0b72d4890eb18d510806'}

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def sanitize(text):
    text = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', text)
    text = re.sub(r'(?i)(postgres(?:ql)?://)[^\s]+', r'\1[REDACTED]', text)
    text = re.sub(r'(?i)(authorization\s*[:=]\s*)([^\n]+)', r'\1[REDACTED]', text)
    text = re.sub(r'(?i)((?:[A-Z_]*(?:SECRET|PASSWORD|ACCESS_TOKEN|SERVICE_ROLE_KEY|API_KEY)[A-Z_]*)\s*[:=]\s*)[^\s,]+', r'\1[REDACTED]', text)
    text = re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[REDACTED-JWT]', text)
    return text

def parse_counts(text, kind, rc):
    out = dict(tests=None, passed=None, failed=None, errors=None, assertions=None, discovered=None)
    if kind == 'node':
        for key, word in [('tests','tests'),('passed','pass'),('failed','fail')]:
            matches = re.findall(r'^# '+word+r' (\d+)$', text, re.M)
            if matches: out[key] = int(matches[-1])
    elif kind == 'unittest':
        m = re.search(r'Ran (\d+) tests? in', text)
        if m:
            out['tests'] = int(m[1]); f = re.search(r'failures=(\d+)',text); e = re.search(r'errors=(\d+)',text)
            out['failed'] = int(f[1]) if f else 0; out['errors'] = int(e[1]) if e else 0
            # setUpClass errors are suite errors, not negative executed tests.
            out['passed'] = max(0,out['tests']-out['failed']-out['errors']) if rc == 0 or 'FAILED (' in text else None
    elif kind == 'handlers':
        try:
            obj = json.loads(text); rows = obj['results'] if isinstance(obj,dict) else obj
            out.update(tests=len(rows),passed=sum(r['result']=='PASS' for r in rows),failed=sum(r['result']=='FAIL' for r in rows))
        except (ValueError,KeyError,TypeError): pass
    elif kind == 'security':
        m = re.search(r'"summary":\s*({[^}]+})',text)
        if m:
            s=json.loads(m[1]); out.update(tests=s['total'],passed=s['pass'],failed=s['fail'],errors=s['error'])
    elif kind == 'browser':
        m=re.search(r'"assertions":\s*(\d+)',text)
        if m: out['assertions']=int(m[1])
    elif kind == 'auth':
        m=re.search(r'Audited (\d+) server functions',text)
        if m: out['assertions']=int(m[1])
    elif kind == 'discovery':
        m=re.search(r'Total: (\d+) tests',text)
        if m: out['discovered']=int(m[1])
    return out

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[1])
    p.add_argument('--label',default='baseline',help='baseline or integrated label; source hashes identify exact snapshot')
    p.add_argument('--input-snapshot',type=pathlib.Path,help='Reuse a frozen earlier QA tree beneath profile scratch; git metadata still comes from --repo')
    p.add_argument('--python',default=sys.executable,help='Interpreter with psycopg2; never installs dependencies')
    p.add_argument('--output',type=pathlib.Path,help='NEW directory beneath profile scratch only')
    p.add_argument('--timeout',type=int,default=300,help='Per-suite deadline, 10..600 seconds')
    args=p.parse_args()
    if not 10 <= args.timeout <= 600: p.error('timeout must be 10..600')
    repo=args.repo.resolve()
    source=args.input_snapshot.resolve() if args.input_snapshot else repo
    if args.input_snapshot and (not source.is_relative_to(SCRATCH.resolve()) or not source.is_dir()):
        p.error('input-snapshot must be an existing directory beneath profile scratch')
    SCRATCH.mkdir(parents=True,exist_ok=True)
    if args.output:
        out=args.output.resolve()
        if not out.is_relative_to(SCRATCH.resolve()) or out==SCRATCH.resolve(): p.error('output must be beneath profile scratch')
        out.mkdir(parents=True,exist_ok=False)
    else: out=pathlib.Path(tempfile.mkdtemp(prefix='cxqa-',dir=SCRATCH))
    snap=out/'tree'; snap.mkdir(); (out/'logs').mkdir(); (out/'browser').mkdir()
    home=out/'home'; home.mkdir()
    # macOS Unix socket paths have a 103-byte limit. The longest reviewed
    # fixture suffix is 49 bytes: keep an exclusive five-character PG parent.
    import secrets
    while True:
        pgwork=SCRATCH/('q'+secrets.token_hex(2))
        try: pgwork.mkdir(); break
        except FileExistsError: continue
    # Allowlist environment, not a copy of ambient credentials, DSNs or NODE_OPTIONS.
    env={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'HOME':str(home),'USER':getpass.getuser(),
         'TMPDIR':str(pgwork),'CLINICX_TEST_TMPDIR':str(pgwork),'PG_BIN':str(PG),
         'CLINICX_FRONTEND_SCRATCH':str(out/'browser'),'PYTHONDONTWRITEBYTECODE':'1',
         'LC_ALL':'C','LANG':'C','CI':'1','NO_COLOR':'1'}
    if 'DOCKER_HOST' in os.environ:
        env['DOCKER_HOST'] = os.environ['DOCKER_HOST']
    node=shutil.which('node',path=env['PATH'])
    report={'label':args.label,'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'repository':str(repo),'source':str(source),'snapshot':str(snap),'output':str(out),'pg_work_root':str(pgwork),'suites':[],
            'aggregate_runner_sha256':digest(pathlib.Path(__file__)),
            'runner_review_scope':'Offline synthetic fixtures; imported harnesses and provider doubles inspected before SHA-256 allowlisting',
            'scope':'Offline dirty-tree snapshot; selected-schema PG17; browser components; E2E discovery only',
            'pending_gates':['Full Supabase history replay and upgrade preservation','Hosted Auth/PostgREST and secure session E2E',
                             'Owner E2E scenarios A-E','Live/test-mode provider mandate and recurring lifecycle','Deployment secrets, HTTPS, backup restore and monitoring drills']}
    def save():
        (out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    def run(name,cmd,kind='gate',cwd=None,extra=None):
        started=time.monotonic(); log=out/'logs'/f'{name}.log'; actual=list(map(str,cmd))
        rc=126; text=''; timeout=False
        try:
            proc=subprocess.Popen(actual,cwd=cwd or snap,env={**env,**(extra or {})},stdout=subprocess.PIPE,
                                  stderr=subprocess.STDOUT,text=True,start_new_session=True)
            try: text,_=proc.communicate(timeout=args.timeout); rc=proc.returncode
            except subprocess.TimeoutExpired:
                timeout=True; os.killpg(proc.pid,signal.SIGTERM)
                try: text,_=proc.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid,signal.SIGKILL); text,_=proc.communicate(timeout=5)
                rc=124
        except OSError as e: text=str(e)
        text=sanitize(text); log.write_text(text)
        counts=parse_counts(text,kind,rc)
        report['suites'].append({'name':name,'command':actual,'cwd':str(cwd or snap),'exit_status':rc,
            'status':'PASS' if rc==0 else 'FAIL','timed_out':timeout,'seconds':round(time.monotonic()-started,3),
            'counts':counts,'log':str(log),'scope':kind})
        save(); print(f'{name}: '+('PASS' if rc==0 else 'FAIL')+f' exit={rc} '+json.dumps(counts),flush=True)
        return rc,text
    # Snapshot only source/config inputs. Never copy .env, credentials, generated outputs or .git.
    inputs=['src','scripts','supabase/migrations','tests','public','docs']
    roots=['package.json','package-lock.json','bun.lock','tsconfig.json','vite.config.ts','playwright.config.ts','eslint.config.js','vercel.json']
    hashes={}; unstable=[]
    for rel in inputs+roots:
        src=source/rel
        paths=sorted(src.rglob('*')) if src.is_dir() else [src]
        for f in paths:
            if not f.is_file() or f.is_symlink(): continue
            r=f.relative_to(source)
            if any(x.startswith('.env') or x in ('__pycache__','node_modules') for x in r.parts): continue
            before=digest(f); dest=snap/r; dest.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(f,dest)
            if digest(dest)!=before or digest(f)!=before: unstable.append(str(r))
            hashes[str(r)]=digest(dest)
    report['source_sha256']=hashes
    report['snapshot_changed_during_copy']=unstable
    # Each package points at installed dependencies; Vite cache directories remain snapshot-local.
    nm=snap/'node_modules'; nm.mkdir()
    for package in (repo/'node_modules').iterdir():
        if package.name.startswith('.') and package.name!='.bin': continue
        (nm/package.name).symlink_to(package.resolve(),target_is_directory=package.is_dir())
    run('git-head',['git','rev-parse','HEAD'],cwd=repo)
    run('git-dirty',['git','status','--short'],cwd=repo)
    mismatches=[n for n,h in REVIEWED.items() if hashes.get('scripts/'+n)!=h]
    mismatches += [n for n,h in REVIEWED_TESTS.items() if hashes.get(n)!=h]
    print("Mismatches:", mismatches)
    report['runner_review_mismatches']=mismatches
    save()
    if unstable or mismatches:
        report['fatal']='Snapshot unstable or reviewed test runner changed; inspect/review before updating hashes.'; save()
        print(report['fatal']); print(out/'report.json'); return 1
    if not node: report['fatal']='Node missing'; save(); return 1
    run('python-psycopg2',[args.python,'-c','import sys,psycopg2; print(sys.executable); print(psycopg2.__version__)'])
    run('auth-guards',[node,'scripts/check-auth-guards.mjs'],'auth')
    for n in ['payments','subscription','frontend','admin','recurring','recurring-handlers','admin-authority-server','billing-recovery-http','engagement-safety']:
        run(n+'-offline',[node,'--test','--test-reporter=tap','scripts/test-clinicx-'+n+'.cjs'],'node')
    run('shared-compiler-contracts',[node,'--test','--test-reporter=tap','tests/clinicx-shared-compiler.mjs'],'node')
    run('aggregate-contracts',[args.python,'tests/clinicx-release-runner.py'],'unittest')
    run('engagement-offline',[node,'scripts/test-clinicx-engagement.cjs'])
    run('typecheck-regressions',[node,'--test','--test-reporter=tap','scripts/test-clinicx-typecheck-regressions.mjs'],'node')
    run('payment-adapter',[node,'--test','--test-reporter=tap','scripts/verify-clinicx-payment-adapter.mjs'],'node')
    run('security-handlers',[node,'scripts/clinicx-security-handlers.cjs'],'handlers')
    run('typecheck',[node,'node_modules/typescript/bin/tsc','--noEmit','--pretty','false'])
    # sandbox-exec network denial is mandatory for build, fail closed when unavailable.
    sandbox=shutil.which('sandbox-exec',path=env['PATH'])
    if sandbox:
        run('production-build',[sandbox,'-p','(version 1)(allow default)(deny network*)',node,'node_modules/vite/bin/vite.js','build'])
    else:
        run('production-build',[args.python,'-c','raise SystemExit("BLOCKED: sandbox-exec required for network-denied build")'])
    run('appointment-enum-db',[args.python,'scripts/test-clinicx-appointment-enum-db.py'])
    run('security-db',[args.python,'scripts/clinicx-security-db.py','--output',out/'security-db.json'],'security')
    run('security-db-subscriptions',[args.python,'scripts/clinicx-security-db.py','--with-subscriptions','--output',out/'security-db-subscriptions.json'],'security')
    run('subscription-db',[args.python,'scripts/test-clinicx-subscription-db.py'],'unittest',extra={'CLINICX_SUBSCRIPTION_CAPTURE':str(out/'subscription-capture.json')})
    if (out/'subscription-capture.json').exists():
        run('subscription-payload-contract',[node,'--test','--test-reporter=tap','scripts/test-clinicx-subscription.cjs'],'node',extra={'CLINICX_SUBSCRIPTION_CAPTURE':str(out/'subscription-capture.json')})
    run('payments-db',[args.python,'scripts/test-clinicx-payments-db.py'],'unittest')
    run('recurring-db',[args.python,'scripts/test-clinicx-recurring-db.py'],'unittest')
    run('engagement-db',[args.python,'scripts/test-clinicx-engagement-db.py'],'unittest')
    run('admin-authority-db',[args.python,'scripts/test-clinicx-admin-authority-db.py'],'unittest')
    run('billing-recovery-db',[args.python,'scripts/test-clinicx-billing-recovery-db.py'],'unittest')
    run('engagement-safety-db',[args.python,'scripts/test-clinicx-engagement-safety-db.py'],'unittest')
    admin_rc,_=run('admin-db',[args.python,'scripts/test-clinicx-admin-db.py'],'unittest',extra={'CLINICX_ADMIN_CAPTURE':str(out/'admin-capture.json')})
    if admin_rc==0 and (out/'admin-capture.json').exists():
        run('admin-native-readbacks',[node,'--test','--test-reporter=tap','scripts/test-clinicx-admin-readbacks.cjs'],'node',extra={'CLINICX_ADMIN_CAPTURE':str(out/'admin-capture.json')})
    # Fresh browser context; real components, UI/router doubles and all requests aborted.
    browser_extra={}
    # Explicit local browser avoids download and user's profile. Installed browser only.
    chrome=pathlib.Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    if chrome.exists(): browser_extra['CLINICX_TEST_CHROMIUM_PATH']=str(chrome)
    run('frontend-browser',[node,'scripts/test-clinicx-frontend-browser.mjs'],'browser',extra=browser_extra)
    run('e2e-discovery',[node,'node_modules/@playwright/test/cli.js','test','--list','--reporter=list'],'discovery',
        extra={'PLAYWRIGHT_HTML_OUTPUT_DIR':str(out/'playwright-report')})
    # Capability probe only. Never starts Docker, Supabase or ambient database services.
    run('docker-capability',['docker','info','--format','{{json .ServerVersion}}'])
    run('supabase-version',['supabase','--version'])
    # Emergency cleanup limited to clusters created under this exact run directory.
    for data in pgwork.glob('*/data'):
        if (data/'postmaster.pid').exists():
            run('cleanup-'+data.parent.name,[PG/'pg_ctl','-D',data,'-m','fast','-w','stop'])
    report['snapshot_mutated_inputs']=[r for r,h in hashes.items() if not (snap/r).is_file() or digest(snap/r)!=h]
    if report['snapshot_mutated_inputs']:
        run('snapshot-provenance',[args.python,'-c','raise SystemExit("FAIL: source input changed during QA; see snapshot_mutated_inputs")'])
    report['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    report['suite_totals']={s:sum(x['status']==s for x in report['suites']) for s in ('PASS','FAIL')}
    report['known_test_counts']={k:sum(x['counts'][k] or 0 for x in report['suites']) for k in ('tests','passed','failed','errors','assertions','discovered')}
    report['readiness']='NOT READY FOR PRODUCTION'
    report['exit_status']=1 if report['suite_totals']['FAIL'] else 2 # pending release gates never greenwash
    save()
    lines=['# ClinicX QA — '+args.label,'','**NOT READY FOR PRODUCTION**','',
           'Snapshot: `'+str(snap)+'`','JSON: `'+str(out/'report.json')+'`','',
           '| Suite | Exit | Test counts (null = not emitted) | Log |','|---|---:|---|---|']
    for s in report['suites']:
        lines.append('| '+s['name']+' | '+str(s['exit_status'])+' | `'+json.dumps(s['counts'])+'` | `'+s['log']+'` |')
    lines+=['','## Pending release gates']+['- '+g for g in report['pending_gates']]
    (out/'report.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps({'report_json':str(out/'report.json'),'report_md':str(out/'report.md'),
                      'suite_totals':report['suite_totals'],'counts':report['known_test_counts'],'exit_status':report['exit_status']},indent=2))
    return report['exit_status']

if __name__=='__main__':
    sys.exit(main())
