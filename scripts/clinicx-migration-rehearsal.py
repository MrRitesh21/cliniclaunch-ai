#!/usr/bin/env python3
"""Synthetic PG17 rehearsal. Never reads a DSN, .env, or an existing cluster.
Full-history blockers remain blockers; reduced-schema coverage is NOT Supabase.
"""
import sys
sys.dont_write_bytecode = True
import ast
import getpass
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
import uuid
import psycopg2
from psycopg2 import sql

ROOT = Path(__file__).resolve().parents[1]
SCRATCH = Path('/Users/ritesh/.hermes/profiles/sara/cache/scratch')
BIN = Path('/opt/homebrew/opt/postgresql@17/bin')
PORT = 55447
ENV = {k: v for k, v in os.environ.items() if not k.startswith('PG') and k not in ('DATABASE_URL', 'SUPABASE_DB_URL')}
ENV.update(LC_ALL='C', TMPDIR=str(SCRATCH))
REPORT = {'boundary': 'synthetic native PG17; NOT hosted Supabase/JWT/PostgREST/storage/cron certification', 'runs': {}, 'assertions': [], 'suites': [], 'omitted_tests': []}
WORK = None

def cmd(args, check=True):
    p = subprocess.run([str(x) for x in args], env=ENV, cwd=ROOT, text=True, capture_output=True, timeout=180)
    if check and p.returncode:
        raise RuntimeError(' '.join(map(str,args))+'\n'+p.stdout+p.stderr)
    return p

class Cluster:
    def __init__(self, label):
        self.base = Path(tempfile.mkdtemp(prefix='cx'+label+'-', dir=SCRATCH))
        self.data = self.base/'d'; self.socket = self.base/'s'; self.socket.mkdir(mode=0o700)
        if len(str(self.socket))+20 >= 104:
            raise RuntimeError('Unix socket path too long')
        cmd([BIN/'initdb','-D',self.data,'-A','trust','--no-locale','-E','UTF8'])
        cmd([BIN/'pg_ctl','-D',self.data,'-l',self.base/'postgres.log','-o',f"-k {self.socket} -c listen_addresses='' -p {PORT}",'-w','start'])
        self.con = self.connect('postgres')
    def connect(self, db):
        c = psycopg2.connect(host=str(self.socket),port=PORT,dbname=db,user=getpass.getuser())
        c.autocommit = True
        with c.cursor() as cur:
            cur.execute("SET statement_timeout='30s'; SET lock_timeout='10s'")
        return c
    def psql(self, db, path):
        return cmd([BIN/'psql','-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-h',self.socket,'-p',PORT,'-U',getpass.getuser(),'-d',db,'--single-transaction','-f',path],check=False)
    def stop(self):
        self.con.close()
        cmd([BIN/'pg_ctl','-D',self.data,'-m','fast','-w','stop'])

def check(name, actual, expected):
    REPORT['assertions'].append({'name':name,'pass':actual==expected,'actual':actual,'expected':expected})
    # Collect failures without skipping later security assertions; final exit remains nonzero.
    return actual == expected

def execute(c, query, params=()):
    with c.cursor() as cur:
        cur.execute(query,params if params else None)
        return cur.fetchall() if cur.description else None

def bootstrap(c, storage=False, profiles=False):
    execute(c,"""CREATE EXTENSION pgcrypto; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,
      raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}',created_at timestamptz DEFAULT now());
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('sub',auth.uid(),'email',current_setting('request.jwt.claim.email',true)) $$;
    CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;""")
    if profiles:
        execute(c,'CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),full_name text)')
    if storage:
        execute(c,"""CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean DEFAULT false);
        CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid);
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
        CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
        GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
        GRANT ALL ON storage.objects,storage.buckets TO service_role;
        GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;""")

def migration_file(prefix):
    found=list((ROOT/'supabase/migrations').glob(prefix+'*.sql'))
    if len(found)!=1: raise RuntimeError(f'Ambiguous prefix {prefix}')
    return found[0]

def apply(cluster, db, paths, label):
    records=[]
    for path in paths:
        p=cluster.psql(db,path)
        log=WORK/(label+'-'+path.name+'.log');log.write_text(p.stdout+p.stderr)
        match=re.search(r'psql:.*?:(\d+): ERROR:\s+([A-Z0-9]{5}):\s*(.*)',p.stderr)
        record={'file':path.name,'start_line':1,'end_line':len(path.read_text().splitlines()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'committed':p.returncode==0,'log':str(log)}
        if p.returncode:
            record.update(sqlstate=match.group(2) if match else None,line=int(match.group(1)) if match else None,error=match.group(3) if match else p.stderr[-3000:])
        records.append(record)
        if p.returncode: break
    REPORT['runs'][label]={'attempted':len(records),'committed':sum(r['committed'] for r in records),'files':records,'complete':len(records)==len(paths) and all(r['committed'] for r in records)}
    return REPORT['runs'][label]['complete']

def fragment(c,prefix,start=1,end=None):
    p=migration_file(prefix);lines=p.read_text().splitlines();end=end or len(lines)
    execute(c,'\n'.join(lines[start-1:end]))
    REPORT.setdefault('reduced_prerequisites',[]).append({'file':p.name,'start_line':start,'end_line':end,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})

def payment_prerequisites(c):
    # Exact fixture SQL, recorded with its source lines/hash. No hidden migration rewrites.
    p=ROOT/'scripts/test-clinicx-payments-db.py';tree=ast.parse(p.read_text())
    node=next(n for n in ast.walk(tree) if isinstance(n,ast.Constant) and isinstance(n.value,str) and n.value.startswith('CREATE TABLE public.transactions'))
    execute(c,node.value)
    REPORT.setdefault('fixture_prerequisites',[]).append({'source':str(p),'start_line':node.lineno,'end_line':node.end_lineno,'sql_sha256':hashlib.sha256(node.value.encode()).hexdigest()})

def reduced(c):
    bootstrap(c,profiles=True)
    slices=[('20260621120020_',24,None),('20260621120253_',1,None),('20260628060119_',1,None),
      ('20260628143853_',1,None),('20260628144109_',1,None),('20260628163743_',90,113),
      ('20260628164219_',1,None),('20260703054900_',1,None),('20260704160626_',84,86),
      ('20260726090000_',1,22),('20260726150100_',1,None),('20260726150200_',1,None),
      ('20260731091910_',1,57),('20260731091910_',182,204),('20260731091910_',209,238),
      ('20260813071033_',1,None),('20260925040251_',1,None)]
    for pre,start,end in slices: fragment(c,pre,start,end)
    payment_prerequisites(c)
    # Payment fixture's historical invoice status prerequisite is applied after synthetic table setup.
    fragment(c,'20260705100450_')
    execute(c,"""ALTER TABLE clinics ADD COLUMN suspended_at timestamptz, ADD COLUMN suspended_reason text,
      ADD COLUMN wa_session_id text, ADD COLUMN wa_status text DEFAULT 'disconnected',
      ADD COLUMN gsc_verified boolean DEFAULT false, ADD COLUMN is_published boolean DEFAULT false""")
    REPORT['fixture_prerequisites'].append({'source':'inline reduced fixture','detail':'Later clinic authority columns; bootstrap auth/profiles/roles/functions are explicit native mocks, not Supabase implementations.'})

def seed(c):
    u,org,clinic,patient,appt,rx,inv,payment,sub=[str(uuid.uuid4()) for _ in range(9)]
    execute(c,'INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(%s,%s,now())',(u,'legacy@example.invalid'))
    execute(c,"SELECT set_config('request.jwt.claim.sub',%s,false)",(u,))
    execute(c,"INSERT INTO organizations(id,slug,name) VALUES(%s,'synthetic-preservation','Synthetic legacy')",(org,))
    execute(c,"INSERT INTO clinics(id,organization_id,owner_id,slug) VALUES(%s,%s,%s,'synthetic-preservation')",(clinic,org,u))
    execute(c,"INSERT INTO patients(id,organization_id,clinic_id,name) VALUES(%s,%s,%s,'Synthetic preservation')",(patient,org,clinic))
    execute(c,"INSERT INTO appointments(id,organization_id,clinic_id,patient_id,patient_name,appointment_date,appointment_time) VALUES(%s,%s,%s,%s,'Synthetic preservation',current_date,'10:00')",(appt,org,clinic,patient))
    execute(c,"INSERT INTO prescriptions(id,organization_id,patient_id,patient_name) VALUES(%s,%s,%s,'Synthetic preservation')",(rx,org,patient))
    execute(c,"INSERT INTO patient_invoices(id,organization_id,patient_id,patient_name,invoice_number,total,status) VALUES(%s,%s,%s,'Synthetic preservation','SYN-PRESERVE',150,'sent')",(inv,org,patient))
    execute(c,'INSERT INTO patient_payments(id,organization_id,invoice_id,amount) VALUES(%s,%s,%s,150)',(payment,org,inv))
    execute(c,"INSERT INTO subscriptions(id,organization_id,plan_id,status,trial_ends_at,current_period_end,razorpay_subscription_id) VALUES(%s,%s,'enterprise','active',now()+interval '10 years',now()+interval '50 days','synthetic-ambiguous')",(sub,org))
    return org

PRESERVE={'clinics':'id,organization_id,owner_id','patients':'id,organization_id,clinic_id,name','appointments':'id,organization_id,clinic_id,patient_id,status','prescriptions':'id,organization_id,patient_id','patient_invoices':'id,organization_id,patient_id,total,amount_paid,status','patient_payments':'id,organization_id,invoice_id,amount','subscriptions':'id,organization_id,plan_id,status,trial_ends_at,current_period_end,razorpay_subscription_id'}
def preservation(c):
    return {t:execute(c,f'SELECT {cols} FROM {t} ORDER BY id') for t,cols in PRESERVE.items()}

def inventory(c):
    tables=execute(c,"SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth') ORDER BY 1,2")
    rows={}
    for schema,table in tables:
        query=sql.SQL('SELECT to_jsonb(t) FROM {}.{} t').format(sql.Identifier(schema),sql.Identifier(table))
        values=[r[0] for r in execute(c,query)]
        values.sort(key=lambda r:json.dumps(r,sort_keys=True,default=str))
        rows[schema+'.'+table]={'count':len(values),'rows_sha256':hashlib.sha256(json.dumps(values,sort_keys=True,default=str).encode()).hexdigest(),'ids':[r.get('id',r.get('organization_id')) for r in values]}
    return {'tables':rows,'constraints':execute(c,"SELECT conrelid::regclass::text,conname,contype,convalidated,pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2"),'policies':execute(c,"SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY 2,3"),'grants':execute(c,"SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' ORDER BY 1,2,3"),'column_grants':execute(c,"SELECT grantee,table_name,column_name,privilege_type FROM information_schema.role_column_grants WHERE table_schema='public' ORDER BY 1,2,3,4")}

def load(file):
    spec=importlib.util.spec_from_file_location(file.replace('-','_'),ROOT/'scripts'/file)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def suites(cluster,dump,legacy_org,legacy_before):
    configs=[('test-clinicx-subscription-db.py','SubscriptionDB'),('test-clinicx-recurring-db.py','RecurringDB'),('test-clinicx-admin-db.py','AdminDB'),('test-clinicx-engagement-db.py','EngagementDB')]
    for i,(file,name) in enumerate(configs):
        db='suite'+str(i);execute(cluster.con,sql.SQL('CREATE DATABASE {}').format(sql.Identifier(db)))
        cmd([BIN/'pg_restore','--exit-on-error','-h',cluster.socket,'-p',PORT,'-U',getpass.getuser(),'-d',db,dump])
        con=cluster.connect(db);cl=getattr(load(file),name)
        cl.setUpClass=classmethod(lambda cls:None);cl.tearDownClass=classmethod(lambda cls:None)
        cl.con=con;cl.c=con.cursor();cl.socket=cluster.socket;cl.legacy_org=legacy_org;cl.legacy_before=legacy_before
        names=unittest.defaultTestLoader.getTestCaseNames(cl)
        # These sibling bridge/concurrency cases hard-code database='postgres'; do not silently test the wrong schema.
        excluded=[n for n in names if any(x in n for x in ('real_service','real_worker','concurrent','real_server'))]
        REPORT['omitted_tests'].extend({'suite':name,'test':n,'reason':'Sibling test connection hardcodes postgres/port; not safe to redirect silently to per-suite database. Separate existing harness required.'} for n in excluded)
        tests=unittest.TestSuite(cl(n) for n in names if n not in excluded)
        output=io.StringIO();r=unittest.TextTestRunner(stream=output,verbosity=2).run(tests)
        path=WORK/(name+'.log');path.write_text(output.getvalue())
        REPORT['suites'].append({'suite':name,'run':r.testsRun,'failures':len(r.failures),'errors':len(r.errors),'skipped':len(r.skipped),'log':str(path),'failures_detail':[(str(t),e) for t,e in r.failures+r.errors]})
        con.close()

def integration(c):
    """Cross-slice clinical/RLS/invite/notification/recurrence/admin probes."""
    base=load('test-clinicx-payments-db.py').PaymentsDB
    t=base('test_actor_context_bound_to_org_and_no_client_settlement_authority');t.con=c;t.c=c.cursor()
    base.setUp(t);org=t.configure();sid=t.bind(t.reserve(org));e=t.evidence(sid)
    start=execute(c,'SELECT floor(extract(epoch from now()))::bigint')[0][0];e.update(period_start=start-1,period_end=start+86400*30)
    t.settle(e)
    execute(c,'RESET ROLE');execute(c,"UPDATE plans SET monthly_price=8599,yearly_price=85990 WHERE id='professional'")
    execute(c,"INSERT INTO clinicx_provider_prices VALUES('professional','monthly','plan_Pro',859900,now()) ON CONFLICT DO NOTHING")
    execute(c,'SET ROLE authenticated');command=execute(c,"SELECT clinicx_reserve_recurring(%s,'change','professional','monthly',NULL)",(org,))[0][0]
    execute(c,'SET ROLE service_role');execute(c,'SELECT clinicx_finish_recurring(%s,%s,%s)',(command['id'],t.user,json.dumps({'id':sid,'plan_id':'plan_Pro','status':'active','has_scheduled_changes':True,'change_scheduled_at':e['period_end'],'quantity':1})))
    execute(c,'RESET ROLE');execute(c,"UPDATE clinicx_recurring_commands SET effective_at=now()-interval '1 hour' WHERE id=%s",(command['id'],))
    new=dict(e,payment_id='pay_SyntheticSwitch',invoice_id='inv_SyntheticSwitch',provider_plan_id='plan_Pro',amount_paise=859900,period_end=e['period_end']+1)
    execute(c,'SET ROLE service_role');check('switched charge settles',t.settle(new)['success'],True)
    late=dict(e,payment_id='pay_SyntheticLate',invoice_id='inv_SyntheticLate',period_start=start-7200,period_end=e['period_end']-7200)
    check('late old-plan capture settles',t.settle(late)['success'],True)
    check('late capture cannot replace switched effective plan',execute(c,'SELECT plan_id,current_period_end=to_timestamp(%s) FROM subscriptions WHERE organization_id=%s',(new['period_end'],org))[0],('professional',True))
    check('late invoice owns original quote',execute(c,'SELECT canonical_provider_plan_id FROM invoices WHERE canonical_payment_id=%s',(late['payment_id'],))[0][0],'plan_Growth')
    execute(c,'RESET ROLE');execute(c,"INSERT INTO user_roles(user_id,role) VALUES(%s,'support')",(t.user,));execute(c,'SET ROLE authenticated')
    execute(c,'BEGIN READ ONLY');stats=execute(c,'SELECT clinicx_admin_billing_stats()')[0][0];execute(c,'COMMIT')
    check('admin MRR takes canonical effective switched capture',stats['mrr'],8599)
    check('ambiguous legacy subscription excluded from paid MRR',stats['paidCustomers'],1)
    (WORK/'integrated-admin-stats.json').write_text(json.dumps(stats,indent=2))
    execute(c,'RESET ROLE')
    (WORK/'integrated-canonical-capture-evidence.json').write_text(json.dumps({'ledger':execute(c,'SELECT gateway_payment_id,canonical_provider_plan_id,plan,canonical_amount_paise FROM transactions WHERE organization_id=%s ORDER BY gateway_payment_id',(org,)), 'admin_view':execute(c,'SELECT gateway_payment_id,plan_id,canonical_amount_paise FROM clinicx_admin_canonical_payments WHERE organization_id=%s ORDER BY gateway_payment_id',(org,)), 'effective_subscription':execute(c,'SELECT plan_id,status,access_source,current_period_start,current_period_end FROM subscriptions WHERE organization_id=%s',(org,))},indent=2,default=str))
    # Tenant B is a genuine separately provisioned trial, not a fabricated tenant column.
    execute(c,'RESET ROLE');execute(c,'DELETE FROM user_roles WHERE user_id=%s',(t.user,));user_b=str(uuid.uuid4());execute(c,'INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(%s,%s,now())',(user_b,'doctor-b@example.invalid'))
    execute(c,"SELECT set_config('request.jwt.claim.sub',%s,false)",(user_b,));execute(c,'SET ROLE authenticated')
    b=execute(c,"SELECT clinicx_provision_trial(%s,'Synthetic B','Doctor B','clinic')",('b-'+user_b,))[0][0];org_b=b['organization_id']
    events_before=execute(c,'SELECT event_key,kind FROM subscription_events WHERE organization_id=%s ORDER BY event_key',(org_b,))
    check('cumulative trial retry does not duplicate activation events',execute(c,"SELECT clinicx_provision_trial(%s,'Synthetic B','Doctor B','clinic')",('b-'+user_b,))[0][0],b)
    check('cumulative trial event set stable',execute(c,'SELECT event_key,kind FROM subscription_events WHERE organization_id=%s ORDER BY event_key',(org_b,)),events_before)
    REPORT['cumulative_provision_events']=events_before
    pb=execute(c,"INSERT INTO patients(organization_id,name) VALUES(%s,'Synthetic B') RETURNING id",(org_b,))[0][0]
    rb=execute(c,"INSERT INTO prescriptions(organization_id,patient_id,patient_name) VALUES(%s,%s,'Synthetic B') RETURNING id",(org_b,pb))[0][0]
    ib=execute(c,"INSERT INTO patient_invoices(organization_id,patient_id,patient_name,invoice_number,total,status) VALUES(%s,%s,'Synthetic B','SYN-NEGATIVE-B',200,'sent') RETURNING id",(org_b,pb))[0][0]
    ab=execute(c,"INSERT INTO appointments(organization_id,patient_id,patient_name,appointment_date,appointment_time) VALUES(%s,%s,'Synthetic B',current_date,'10:00') RETURNING id",(org_b,pb))[0][0]
    execute(c,'RESET ROLE');execute(c,"SELECT set_config('request.jwt.claim.sub',%s,false)",(t.user,));execute(c,'SET ROLE authenticated')
    for table,identifier in [('prescriptions',rb),('patient_invoices',ib),('appointments',ab)]:
        for operation in ('read','update','delete'):
            q=f'SELECT id FROM {table} WHERE id=%s' if operation=='read' else f'UPDATE {table} SET id=id WHERE id=%s RETURNING id' if operation=='update' else f'DELETE FROM {table} WHERE id=%s RETURNING id'
            check('A cannot '+operation+' B '+table,execute(c,q,(identifier,)),[])
    def reject_link(name,query,params):
        try:execute(c,query,params)
        except psycopg2.Error as err:check(name,err.pgcode in ('23503','42501'),True)
        else:check(name,'ALLOWED','23503/42501')
    reject_link('A clinical payment cannot settle B invoice',"INSERT INTO patient_payments(organization_id,invoice_id,amount) VALUES(%s,%s,200)",(org,ib))
    reject_link('A prescription child cannot link B prescription',"INSERT INTO prescription_items(organization_id,prescription_id,drug_name) VALUES(%s,%s,'Synthetic forbidden')",(org,rb))
    execute(c,'RESET ROLE');check('denied cross-tenant payment leaves B invoice unchanged',execute(c,'SELECT amount_paid,status FROM patient_invoices WHERE id=%s',(ib,))[0],(0,'sent'))
    check('denied cross-tenant payment produces no ledger side effect',execute(c,'SELECT count(*) FROM finance_ledger WHERE invoice_id=%s',(ib,))[0][0],0)
    execute(c,'SET ROLE authenticated')
    check('ordinary A cannot read B patient',execute(c,'SELECT id FROM patients WHERE id=%s',(pb,)),[])
    check('ordinary A cannot mutate B patient',execute(c,"UPDATE patients SET name='Forbidden' WHERE id=%s RETURNING id",(pb,)),[])
    def deny(name,query,params=()):
        try:execute(c,query,params)
        except psycopg2.Error as err:check(name,err.pgcode,'42501')
        else:check(name,'ALLOWED','42501')
    deny('clinical admission into B denied',"INSERT INTO patients(organization_id,name) VALUES(%s,'Forbidden')",(org_b,))
    deny('notification title immutable to authenticated',"UPDATE notifications SET title='Forged'")
    deny('notification delivery execute denied','SELECT clinicx_claim_notification_delivery(5)')
    deny('A cannot alter B engagement consent','SELECT clinicx_set_engagement_email(%s,true)',(org_b,))
    execute(c,'SET ROLE service_role');execute(c,'SELECT clinicx_prepare_notification_delivery(50)')
    own_note=execute(c,'SELECT id FROM notifications WHERE user_id=%s ORDER BY created_at LIMIT 1',(t.user,))[0][0]
    foreign_note=execute(c,'SELECT id FROM notifications WHERE user_id=%s ORDER BY created_at LIMIT 1',(user_b,))[0][0]
    execute(c,'SET ROLE authenticated')
    check('owner may mark own notification read',len(execute(c,'UPDATE notifications SET read_at=now() WHERE id=%s RETURNING id',(own_note,))),1)
    check('owner cannot mark foreign notification read',execute(c,'UPDATE notifications SET read_at=now() WHERE id=%s RETURNING id',(foreign_note,)),[])
    execute(c,'RESET ROLE');invitee=str(uuid.uuid4());execute(c,'INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(%s,%s,now())',(invitee,'invitee@example.invalid'))
    execute(c,"SELECT set_config('request.jwt.claim.sub',%s,false)",(user_b,))
    token=execute(c,"INSERT INTO organization_invites(organization_id,email,role) VALUES(%s,'invitee@example.invalid','doctor') RETURNING token",(org_b,))[0][0]
    execute(c,"SELECT set_config('request.jwt.claim.sub',%s,false)",(invitee,));execute(c,"SELECT set_config('request.jwt.claim.email','invitee@example.invalid',false)");execute(c,'SET ROLE authenticated')
    deny('invitee cannot escalate invitation role',"UPDATE organization_invites SET role='owner' WHERE token=%s",(token,))
    check('legitimate doctor invite accepted',str(execute(c,'SELECT accept_invite(%s)',(token,))[0][0]),org_b)
    check('legitimate invite creates active doctor',execute(c,'SELECT is_active FROM doctors WHERE organization_id=%s AND user_id=%s',(org_b,invitee))[0][0],True)
    check('doctor admitted under trial can create own patient',len(execute(c,"INSERT INTO patients(organization_id,name) VALUES(%s,'Synthetic legitimate doctor') RETURNING id",(org_b,))),1)
    check('doctor cannot read foreign clinical data',execute(c,'SELECT id FROM patients WHERE organization_id=%s',(org,)),[])
    execute(c,'RESET ROLE')

def main():
    global WORK
    SCRATCH.mkdir(parents=True,exist_ok=True)
    WORK=Path(tempfile.mkdtemp(prefix='cxreport-',dir=SCRATCH))
    REPORT['artifact_dir']=str(WORK)
    REPORT['capability']={}
    for name,args in [('docker',['docker','info','--format','{{json .ServerVersion}}']),('colima',['colima','status']),('postgres',[BIN/'postgres','--version'])]:
        try:p=cmd(args,check=False);REPORT['capability'][name]={'returncode':p.returncode,'output':p.stdout+p.stderr}
        except FileNotFoundError as e:REPORT['capability'][name]={'error':str(e)}
    paths=sorted((ROOT/'supabase/migrations').glob('*.sql'))
    REPORT['history_inventory']=[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'lines':len(p.read_text().splitlines()),'hazards':[{'line':i,'sql':line.strip()} for i,line in enumerate(p.read_text().splitlines(),1) if re.search(r'\b(DROP TABLE|DELETE FROM|TRUNCATE|UPDATE public.subscriptions|UPDATE public.plans)\b',line,re.I)]} for p in paths]
    clusters=[]
    try:
        bare=Cluster('bare');clusters.append(bare);REPORT['bare_cluster']=str(bare.base)
        apply(bare,'postgres',paths,'bare-history')
        history=Cluster('history');clusters.append(history);REPORT['mock_history_cluster']=str(history.base)
        bootstrap(history.con,storage=True)
        REPORT['full_history_mock_prerequisites']='pgcrypto; explicit auth.users/uid/jwt; anon/authenticated/service_role; reduced storage buckets/objects/foldername. No cron/extensions fabricated.'
        apply(history,'postgres',paths,'mock-prerequisite-history')
        REPORT['available_extensions']=execute(history.con,'SELECT name,default_version,installed_version FROM pg_available_extensions ORDER BY name')
        # Diagnostic continuation only: the missing function is mentioned exclusively by REVOKE.
        # This placeholder is never bound to an event trigger and is NOT a Supabase implementation.
        run=REPORT['runs']['mock-prerequisite-history']
        if not run['complete'] and run['files'][-1]['error']=='function public.rls_auto_enable() does not exist':
            execute(history.con,"CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$")
            REPORT['diagnostic_continuation_prerequisite']='Explicit unbound no-op rls_auto_enable event_trigger signature for REVOKE resolution only; never installed or represented as Supabase RLS auto-enable.'
            apply(history,'postgres',paths[run['committed']:],'mock-extra-prerequisite-continuation')
            continuation=REPORT['runs']['mock-extra-prerequisite-continuation']
            if not continuation['complete'] and continuation['files'][-1]['error']=='schema "extensions" does not exist':
                execute(history.con,'CREATE SCHEMA extensions; ALTER EXTENSION pgcrypto SET SCHEMA extensions')
                REPORT['native_extension_prerequisite']='Real installed pgcrypto relocated into explicitly created extensions schema; not a fabricated extension.'
                apply(history,'postgres',paths[run['committed']+continuation['committed']:],'native-extension-continuation')
                extension_run=REPORT['runs']['native-extension-continuation']
                if not extension_run['complete'] and extension_run['files'][-1]['error']=='publication "supabase_realtime" does not exist':
                    execute(history.con,'CREATE PUBLICATION supabase_realtime')
                    REPORT['native_publication_prerequisite']='Empty native publication named supabase_realtime; no realtime service or WAL consumer.'
                    apply(history,'postgres',paths[run['committed']+continuation['committed']+extension_run['committed']:],'native-publication-continuation')
                    publication_run=REPORT['runs']['native-publication-continuation']
                    if not publication_run['complete'] and publication_run['files'][-1]['error']=='function gen_random_bytes(integer) does not exist':
                        execute(history.con,'ALTER DATABASE postgres SET search_path=public,extensions')
                        REPORT['native_search_path_prerequisite']='Explicit database search_path=public,extensions for unqualified pgcrypto calls; no SQL rewritten.'
                        applied_count=run['committed']+continuation['committed']+extension_run['committed']+publication_run['committed']
                        apply(history,'postgres',paths[applied_count:],'native-search-path-continuation')
                        search_run=REPORT['runs']['native-search-path-continuation']
                        if not search_run['complete'] and search_run['files'][-1]['error']=='function auth.email() does not exist':
                            execute(history.con,"CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.email',true),'') $$")
                            REPORT['auth_email_mock_prerequisite']='Explicit auth.email() session-GUC mock, same boundary as auth.uid/jwt; no auth service.'
                            apply(history,'postgres',paths[applied_count+search_run['committed']:],'mock-auth-email-continuation')
        cluster=Cluster('upgrade');clusters.append(cluster);REPORT['upgrade_cluster']=str(cluster.base)
        reduced(cluster.con);org=seed(cluster.con);before=preservation(cluster.con)
        (WORK/'preservation-before.json').write_text(json.dumps(before,indent=2,default=str))
        (WORK/'constraints-before.json').write_text(json.dumps(inventory(cluster.con)['constraints'],indent=2,default=str))
        upgrade=[p for p in paths if p.name.startswith('20261007')]
        if not apply(cluster,'postgres',upgrade,'all-forward-upgrades'):
            raise RuntimeError('Integrated forward migration failed; see exact file/line/SQLSTATE in report')
        after=preservation(cluster.con);(WORK/'preservation-after.json').write_text(json.dumps(after,indent=2,default=str))
        check('all seeded clinical IDs amounts and ambiguous entitlement columns preserved',after,before)
        execute(cluster.con,'RESET ROLE');inv=inventory(cluster.con)
        (WORK/'catalog-after.json').write_text(json.dumps(inv,indent=2,default=str))
        dump=WORK/'synthetic-upgraded.dump';cmd([BIN/'pg_dump','-Fc','-h',cluster.socket,'-p',PORT,'-U',getpass.getuser(),'-d','postgres','-f',dump])
        restore=Cluster('restore');clusters.append(restore);REPORT['restore_cluster']=str(restore.base)
        execute(restore.con,'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS')
        cmd([BIN/'pg_restore','--exit-on-error','-h',restore.socket,'-p',PORT,'-U',getpass.getuser(),'-d','postgres',dump])
        restored=inventory(restore.con);check('fresh-cluster restore exact row hashes counts IDs constraints RLS grants',restored,inv)
        (WORK/'restore-catalog.json').write_text(json.dumps(restored,indent=2,default=str))
        REPORT['backup']={'path':str(dump),'sha256':hashlib.sha256(dump.read_bytes()).hexdigest(),'tables':len(inv['tables']),'rows':sum(v['count'] for v in inv['tables'].values()),'verified':True}
        suites(cluster,dump,org,tuple(before['subscriptions'][0][i] for i in (0,2,3,4,5,6)))
        integration(cluster.con)
        # Also restore the exercised SaaS captured ledger and doctor admission, not only the legacy seed.
        integrated_inventory=inventory(cluster.con)
        integrated_dump=WORK/'synthetic-integrated.dump'
        cmd([BIN/'pg_dump','-Fc','-h',cluster.socket,'-p',PORT,'-U',getpass.getuser(),'-d','postgres','-f',integrated_dump])
        execute(restore.con,'CREATE DATABASE integrated_restore')
        cmd([BIN/'pg_restore','--exit-on-error','-h',restore.socket,'-p',PORT,'-U',getpass.getuser(),'-d','integrated_restore',integrated_dump])
        restored_con=restore.connect('integrated_restore')
        try:check('captured payments late charges doctor admission full restore parity',inventory(restored_con),integrated_inventory)
        finally:restored_con.close()
        REPORT['integrated_backup']={'path':str(integrated_dump),'sha256':hashlib.sha256(integrated_dump.read_bytes()).hexdigest(),'tables':len(integrated_inventory['tables']),'rows':sum(v['count'] for v in integrated_inventory['tables'].values()),'verified':True}
        (WORK/'integrated-catalog.json').write_text(json.dumps(integrated_inventory,indent=2,default=str))
    except Exception as err:
        REPORT['fatal']={'type':type(err).__name__,'message':str(err)}
        import traceback
        REPORT['fatal']['traceback']=traceback.format_exc()
    finally:
        for cluster in reversed(clusters):
            try:cluster.stop()
            except Exception as e:REPORT.setdefault('cleanup_errors',[]).append(str(e))
        REPORT['summary']={'history_total':len(paths),'forward_total':len([p for p in paths if p.name.startswith('20261007')]),'assertion_pass':sum(a['pass'] for a in REPORT['assertions']),'assertion_fail':sum(not a['pass'] for a in REPORT['assertions']),'suite_tests':sum(s['run'] for s in REPORT['suites']),'suite_failures':sum(s['failures'] for s in REPORT['suites']),'suite_errors':sum(s['errors'] for s in REPORT['suites'])}
        (WORK/'report.json').write_text(json.dumps(REPORT,indent=2,default=str))
        print(json.dumps({'report':str(WORK/'report.json'),'summary':REPORT['summary'],'fatal':REPORT.get('fatal'),'history_blockers':{k:v['files'][-1] for k,v in REPORT['runs'].items() if not v['complete']}},indent=2,default=str))
    failures=REPORT.get('fatal') or REPORT['summary']['assertion_fail'] or REPORT['summary']['suite_failures'] or REPORT['summary']['suite_errors']
    raise SystemExit(1 if failures else 2 if not REPORT['runs'].get('mock-prerequisite-history',{}).get('complete') else 0)

if __name__=='__main__':main()
