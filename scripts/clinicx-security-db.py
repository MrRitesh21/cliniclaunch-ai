import json, subprocess, tempfile, pathlib, re, uuid, os, shutil, argparse, getpass, sys
parser=argparse.ArgumentParser(description="Disposable synthetic PostgreSQL role tests; NOT full Supabase")
parser.add_argument("--baseline",action="store_true")
parser.add_argument("--slice",choices=["invite","links","authority","all"],default="all")
parser.add_argument('--with-subscriptions',action='store_true',help='Compose real subscription migrations with exact historical prerequisites and synthetic 30-day free-trial authority')
parser.add_argument("--output",type=pathlib.Path)
args=parser.parse_args()
import psycopg2
os.environ['LC_ALL']='C'
ROOT=pathlib.Path(__file__).resolve().parents[1]
SCRATCH=pathlib.Path(os.environ.get('CLINICX_TEST_TMPDIR', tempfile.gettempdir()))
def pg_bin():
    if os.environ.get('PG_BIN'): return pathlib.Path(os.environ['PG_BIN'])
    if shutil.which('initdb'): return pathlib.Path(shutil.which('initdb')).parent
    if shutil.which('pg_config'):
        return pathlib.Path(subprocess.check_output(['pg_config','--bindir'],text=True).strip())
    for candidate in ['/opt/homebrew/opt/postgresql@17/bin','/usr/lib/postgresql/17/bin']:
        if (pathlib.Path(candidate)/'initdb').exists(): return pathlib.Path(candidate)
    raise SystemExit('PostgreSQL server tools required; set PG_BIN to their directory')
BIN=pg_bin()
work=pathlib.Path(tempfile.mkdtemp(prefix='clinicx-db-audit-',dir=SCRATCH)); data=work/'data'; socket=work/'socket'; socket.mkdir()
# Unix socket only, brand-new synthetic cluster; never use project env/remote DSN.
subprocess.run([str(BIN/'initdb'),'-D',str(data),'-A','trust','--no-locale','-E','UTF8'],check=True,stdout=subprocess.DEVNULL)
subprocess.run([str(BIN/'pg_ctl'),'-D',str(data),'-l',str(work/'postgres.log'),'-o',f"-k {socket} -c listen_addresses='' -p 55439",'-w','start'],check=True,stdout=subprocess.DEVNULL)
results=[]; applied=[]
try:
    con=psycopg2.connect(host=str(socket),port=55439,dbname='postgres',user=getpass.getuser()); con.autocommit=True
    cur=con.cursor()
    cur.execute("""CREATE EXTENSION pgcrypto; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz); CREATE TABLE public.profiles(id uuid PRIMARY KEY,full_name text); CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;""")
    def migration(prefix,start=0,end=None):
        p=next((ROOT/'supabase/migrations').glob(prefix+'*.sql')); lines=p.read_text().splitlines(); sql='\n'.join(lines[start:end]); cur.execute(sql); applied.append({'file':p.name,'start_line':start+1,'end_line':end or len(lines)})
    migration('20260621120020_',23) # omit obsolete destructive DROP preamble in this selected-schema harness
    migration('20260621120253_')
    migration('20260628143853_')
    migration('20260628144109_')
    migration('20260628164219_')
    migration('20260703054900_')
    migration('20260726150100_')
    migration('20260726150200_')
    migration('20260630063430_',75,97) # exact patient organization-fill function/trigger only
    cur.execute("ALTER TABLE clinics ADD COLUMN suspended_at timestamptz; ALTER TABLE clinics ADD COLUMN suspended_reason text; ALTER TABLE clinics ADD COLUMN wa_session_id text; ALTER TABLE clinics ADD COLUMN wa_status text DEFAULT 'disconnected'; ALTER TABLE clinics ADD COLUMN gsc_verified boolean DEFAULT false; ALTER TABLE clinics ADD COLUMN is_published boolean DEFAULT false;") # minimal later-column prerequisites
    migration('20260704121000_')
    cur.execute('DROP POLICY "public can book" ON appointments')
    migration('20260705121717_',2,18) # exact final public appointment policy, no unrelated helpers/reviews
    # Reproduce the July broad policy AND its August removal; final state wins.
    cur.execute('CREATE POLICY "Anon and authenticated read published clinics" ON clinics FOR SELECT TO anon, authenticated USING (is_published = true OR public.is_org_member(organization_id, auth.uid()))')
    migration('20260807131020_',0,5)
    cur.execute("CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('sub',auth.uid(),'email',current_setting('request.jwt.claim.email',true)) $$")
    migration('20260628163743_',89,113)
    migration('20260702173658_')
    # Final July removal of blanket invite read; preserve scoped invitee SELECT.
    cur.execute('DROP POLICY "Anyone can read invite by token" ON organization_invites')
    migration('20260704160626_',83,86) # exact trigger EXECUTE revokes; triggers must remain exercised
    migration('20260731091910_',0,57) # ledger table/policies only
    migration('20260731091910_',181,204) # finance_audit table/policies only
    migration('20260731091910_',208,238) # actual payment ledger triggers
    ids={k:str(uuid.uuid4()) for k in ['ownerA','ownerB','staffA','orgA','orgB','clinicA','clinicB','patientA','patientB','appointmentB','prescriptionB','invoiceB','itemB','batchB','saleA']}
    for who in ['ownerA','ownerB','staffA']: cur.execute('INSERT INTO auth.users VALUES (%s,%s,now())',(ids[who],'synthetic-staff@example.invalid' if who=='staffA' else who+'@example.invalid'))
    for side in ['A','B']:
        cur.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(ids['owner'+side],))
        cur.execute('INSERT INTO organizations(id,slug,name) VALUES (%s,%s,%s)',(ids['org'+side],'synthetic-'+side,'Synthetic clinic '+side))
        cur.execute('INSERT INTO clinics(id,organization_id,owner_id,slug,is_published,personal_email) VALUES (%s,%s,%s,%s,true,%s)',(ids['clinic'+side],ids['org'+side],ids['owner'+side],'synthetic-'+side,'synthetic-private-'+side+'@example.invalid'))
        cur.execute('INSERT INTO patients(id,organization_id,clinic_id,name) VALUES (%s,%s,%s,%s)',(ids['patient'+side],ids['org'+side],ids['clinic'+side],'Synthetic patient '+side))
        if not args.with_subscriptions:
            cur.execute("INSERT INTO subscriptions(organization_id,plan_id,status,trial_ends_at) VALUES (%s,'starter','expired',now()-interval '1 day')",(ids['org'+side],))
    cur.execute("INSERT INTO organization_members(organization_id,user_id,role) VALUES (%s,%s,'staff')",(ids['orgA'],ids['staffA']))
    cur.execute("INSERT INTO appointments(id,organization_id,clinic_id,patient_name,appointment_date,appointment_time,scheduled_at) VALUES (%s,%s,%s,'Synthetic B',current_date,'10:00',now())",(ids['appointmentB'],ids['orgB'],ids['clinicB']))
    cur.execute("INSERT INTO prescriptions(id,organization_id,patient_id,patient_name) VALUES (%s,%s,%s,'Synthetic B')",(ids['prescriptionB'],ids['orgB'],ids['patientB']))
    cur.execute("INSERT INTO patient_invoices(id,organization_id,patient_id,patient_name,invoice_number,total,status) VALUES (%s,%s,%s,'Synthetic B','SYN-B-1',100,'sent')",(ids['invoiceB'],ids['orgB'],ids['patientB']))
    cur.execute("INSERT INTO inventory_items(id,organization_id,name,quantity) VALUES (%s,%s,'Synthetic stock B',100)",(ids['itemB'],ids['orgB']))
    cur.execute("INSERT INTO pharmacy_batches(id,organization_id,item_id,batch_no,quantity) VALUES (%s,%s,%s,'SYN-B',100)",(ids['batchB'],ids['orgB'],ids['itemB']))
    cur.execute("INSERT INTO pharmacy_sales(id,organization_id,patient_name) VALUES (%s,%s,'Synthetic A')",(ids['saleA'],ids['orgA']))
    legacy_id=str(uuid.uuid4())
    cur.execute("INSERT INTO patients(id,organization_id,clinic_id,name) VALUES (%s,%s,%s,'Synthetic legacy mixed link')",(legacy_id,ids['orgA'],ids['clinicB']))
    if not args.baseline: migration('20261007120000_')
    if args.with_subscriptions:
        # Exact historical dependencies, not a fabricated production table/helper.
        migration('20260628060119_') # user_roles, has_role and genuine is_admin
        migration('20260925040251_') # organization_module_overrides with its RLS
        migration('20260726090000_',0,22) # null-JWT creator bootstrap; omit demo seed
        for p in sorted((ROOT/'supabase/migrations').glob('2026100713*.sql')):
            migration(p.stem)
        # Synthetic existing clinics receive real trial provenance, NOT invented paid Enterprise access.
        cur.execute("SELECT set_config('request.jwt.claim.sub','',false)")
        cur.execute("INSERT INTO subscriptions(organization_id,status,plan_id,access_source,trial_started_at,trial_ends_at,grace_ends_at,current_period_start,current_period_end) SELECT id,'trialing','growth','free_trial',now(),now()+interval '720 hours',now()+interval '888 hours',now(),now()+interval '720 hours' FROM organizations")
    def actor(who):
        cur.execute('RESET ROLE'); cur.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(ids[who],)); cur.execute('SET ROLE authenticated')
    def record(name,expect_secure,fn,denied=False):
        category = 'invite' if 'invite' in name else 'authority' if ('clinic authority' in name or 'clinic owner' in name or 'audit' in name) else 'links'
        if args.slice != 'all' and category != args.slice: return
        cur.execute('BEGIN'); cur.execute('SAVEPOINT probe')
        try:
            secure,detail=fn(); results.append({'test':name,'secure_expected':expect_secure,'secure_observed':secure,'result':'PASS' if secure==expect_secure else 'FAIL','detail':detail})
        except psycopg2.Error as e:
            results.append({'test':name,'secure_expected':expect_secure,'secure_observed':e.pgcode in ('42501','23503','23514'),'result':'PASS' if denied and e.pgcode in ('42501','23503','23514') else 'ERROR','sqlstate':e.pgcode,'detail':e.diag.message_primary})
        finally: cur.execute('ROLLBACK')
    actor('ownerA')
    for table,key in [('patients','patientB'),('appointments','appointmentB'),('prescriptions','prescriptionB'),('patient_invoices','invoiceB')]:
        def read(t=table,k=key):
            cur.execute(f'SELECT id FROM {t} WHERE id=%s',(ids[k],)); n=len(cur.fetchall()); return n==0,{'rows':n}
        record(table+': A reads B',True,read)
        def upd(t=table,k=key):
            cur.execute(f'UPDATE {t} SET id=id WHERE id=%s RETURNING id',(ids[k],)); n=len(cur.fetchall()); return n==0,{'rows':n}
        record(table+': A updates B',True,upd)
        def delete(t=table,k=key):
            cur.execute(f'DELETE FROM {t} WHERE id=%s RETURNING id',(ids[k],)); n=len(cur.fetchall()); return n==0,{'rows':n}
        record(table+': A deletes B',True,delete)
    def insert_b():
        cur.execute("INSERT INTO patients(organization_id,name) VALUES (%s,'Synthetic forbidden')",(ids['orgB'],)); return False,{'inserted':True}
    record('patients: A inserts into B',True,insert_b,denied=True)
    def tamper_sub():
        cur.execute("UPDATE subscriptions SET status='active',plan_id='enterprise',trial_ends_at=now()+interval '10 years' WHERE organization_id=%s RETURNING status,plan_id",(ids['orgA'],)); row=cur.fetchone(); return row is None,{'status':row[0] if row else None,'plan':row[1] if row else None}

    def mixed_patient():
        cur.execute("INSERT INTO patients(organization_id,clinic_id,name) VALUES (%s,%s,'Synthetic mixed') RETURNING organization_id,clinic_id",(ids['orgA'],ids['clinicB'])); row=cur.fetchone(); return row is None,{'mixed_link_inserted':bool(row)}
    record('patient A linked to clinic B',True,mixed_patient,denied=True)
    def mixed_rx():
        cur.execute("INSERT INTO prescription_items(organization_id,prescription_id,drug_name) VALUES (%s,%s,'Synthetic mixed') RETURNING id",(ids['orgA'],ids['prescriptionB'])); return cur.fetchone() is None,{'cross_tenant_child_inserted':True}
    record('A prescription item attached to B prescription',True,mixed_rx,denied=True)
    def payment_b():
        cur.execute("INSERT INTO patient_payments(organization_id,invoice_id,amount) VALUES (%s,%s,100)",(ids['orgA'],ids['invoiceB'])); cur.execute('RESET ROLE'); cur.execute('SELECT status,amount_paid FROM patient_invoices WHERE id=%s',(ids['invoiceB'],)); row=cur.fetchone(); cur.execute('SET ROLE authenticated'); return row[0]!='paid',{'B_invoice_status':row[0],'B_amount_paid':str(row[1])}
    record('A payment settles B invoice through definer trigger',True,payment_b,denied=True)
    def stock_b():
        cur.execute("INSERT INTO pharmacy_sale_items(organization_id,sale_id,item_id,batch_id,drug_name,quantity) VALUES (%s,%s,%s,%s,'Synthetic mixed',1)",(ids['orgA'],ids['saleA'],ids['itemB'],ids['batchB'])); cur.execute('RESET ROLE'); cur.execute('SELECT quantity FROM inventory_items WHERE id=%s',(ids['itemB'],)); q=cur.fetchone()[0]; cur.execute('SET ROLE authenticated'); return q==100,{'B_stock_after':str(q)}
    record('A dispense decrements B inventory through definer trigger',True,stock_b,denied=True)
    def published_b():
        cur.execute('SELECT personal_email FROM clinics WHERE id=%s',(ids['clinicB'],)); row=cur.fetchone(); return row is None,{'private_column_readable':row is not None}
    record('A reads private columns of published clinic B',True,published_b)
    actor('staffA')
    def clinic_owner():
        cur.execute('UPDATE clinics SET owner_id=%s WHERE id=%s RETURNING id',(ids['ownerB'],ids['clinicA'])); return cur.fetchone() is None,{'staff_owner_column_update_allowed':True}
    record('staff alters privileged clinic owner_id',True,clinic_owner,denied=True)
    cur.execute('RESET ROLE')
    cur.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(ids['ownerB'],))
    cur.execute("INSERT INTO organization_invites(organization_id,email,role) VALUES (%s,'synthetic-staff@example.invalid','staff') RETURNING id",(ids['orgB'],))
    invite_id=cur.fetchone()[0]
    cur.execute("SELECT set_config('request.jwt.claim.email','synthetic-staff@example.invalid',false)")
    actor('staffA')
    def elevate_invite():
        cur.execute("UPDATE organization_invites SET role='owner' WHERE id=%s RETURNING role",(invite_id,)); changed=cur.fetchone()
        cur.execute("INSERT INTO organization_members(organization_id,user_id,role) VALUES (%s,%s,'owner') RETURNING role",(ids['orgB'],ids['staffA'])); joined=cur.fetchone(); return not joined,{'own_invite_changed_to_owner':bool(changed),'joined_B_as':joined[0] if joined else None}
    record('staff invitee changes B invite role then joins B as owner',True,elevate_invite,denied=True)
    def direct_join():
        cur.execute("INSERT INTO organization_members(organization_id,user_id,role) VALUES (%s,%s,'staff') RETURNING id",(ids['orgB'],ids['staffA']))
        return cur.fetchone() is None, {'inserted':True}
    record('invite direct join cannot bypass accept authority',True,direct_join,denied=True)
    def accept_legit():
        cur.execute('RESET ROLE')
        cur.execute('SELECT token FROM organization_invites WHERE id=%s',(invite_id,)); token=cur.fetchone()[0]
        cur.execute('SET ROLE authenticated')
        cur.execute('SELECT accept_invite(%s)',(token,)); org=cur.fetchone()[0]
        cur.execute('SELECT role FROM organization_members WHERE organization_id=%s AND user_id=%s',(ids['orgB'],ids['staffA'])); role=cur.fetchone()[0]
        cur.execute('SELECT accepted_at FROM organization_invites WHERE id=%s',(invite_id,)); accepted=cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM audit_log WHERE organization_id=%s AND actor_id=%s AND action='invite.accepted'",(ids['orgB'],ids['staffA'])); count=cur.fetchone()[0]
        return str(org)==ids['orgB'] and role=='staff' and accepted is not None and count==1, {'role':role,'audit_count':count}
    record('invite acceptance inserts immutable role and audit atomically',True,accept_legit)
    def doctor_invite():
        cur.execute('RESET ROLE');cur.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(ids['ownerB'],))
        cur.execute("UPDATE organization_invites SET role='doctor' WHERE id=%s RETURNING token",(invite_id,));token=cur.fetchone()[0]
        actor('staffA');cur.execute('SELECT accept_invite(%s)',(token,))
        cur.execute('SELECT role FROM organization_members WHERE organization_id=%s AND user_id=%s',(ids['orgB'],ids['staffA']));role=cur.fetchone()[0]
        cur.execute('SELECT clinic_id,is_active FROM doctors WHERE organization_id=%s AND user_id=%s',(ids['orgB'],ids['staffA']));doc=cur.fetchone()
        return role=='doctor' and doc is not None and str(doc[0])==ids['clinicB'] and doc[1], {'role':role,'doctor_profile_created':doc is not None}
    record('doctor invite creates own authorized doctor profile atomically',True,doctor_invite)
    for bad in ['expired','wrong-email','consumed','unconfirmed','unknown-token']:
        def invalid_invite(kind=bad):
            cur.execute('RESET ROLE')
            cur.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(ids['ownerB'],))
            if kind=='unconfirmed': cur.execute('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=%s',(ids['staffA'],))
            if kind=='expired': cur.execute("UPDATE organization_invites SET expires_at=now()-interval '1 second' WHERE id=%s",(invite_id,))
            if kind=='wrong-email': cur.execute("UPDATE organization_invites SET email='other@example.invalid' WHERE id=%s",(invite_id,))
            if kind=='consumed': cur.execute('UPDATE organization_invites SET accepted_at=now() WHERE id=%s',(invite_id,))
            cur.execute('SELECT token FROM organization_invites WHERE id=%s',(invite_id,)); token=cur.fetchone()[0]
            cur.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(ids['staffA'],))
            cur.execute('SET ROLE authenticated')
            cur.execute('SELECT accept_invite(%s)',('SYNTHETIC_UNKNOWN' if kind=='unknown-token' else token,))
            return False, {'unexpected_accept':True}
        record('invite rejects '+bad,True,invalid_invite,denied=True)
    def invite_replay():
        cur.execute('RESET ROLE');cur.execute('SELECT token FROM organization_invites WHERE id=%s',(invite_id,)); token=cur.fetchone()[0];cur.execute('SET ROLE authenticated')
        cur.execute('SELECT accept_invite(%s)',(token,));cur.execute('SAVEPOINT replay')
        try:
            cur.execute('SELECT accept_invite(%s)',(token,));return False, {'replay_accepted':True}
        except psycopg2.Error as e:
            if e.pgcode!='42501': raise
            cur.execute('ROLLBACK TO SAVEPOINT replay')
        cur.execute('SELECT count(*) FROM organization_members WHERE organization_id=%s AND user_id=%s',(ids['orgB'],ids['staffA'])); count=cur.fetchone()[0]
        return count==1, {'membership_count':count}
    record('invite replay cannot duplicate membership',True,invite_replay)
    def invite_failure_atomic():
        cur.execute('RESET ROLE')
        cur.execute("CREATE FUNCTION synthetic_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$")
        cur.execute('CREATE TRIGGER synthetic_fail_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION synthetic_fail_audit()')
        cur.execute('SELECT token FROM organization_invites WHERE id=%s',(invite_id,));token=cur.fetchone()[0];cur.execute('SET ROLE authenticated');cur.execute('SAVEPOINT atomic')
        try:
            cur.execute('SELECT accept_invite(%s)',(token,));return False, {'unexpected_accept':True}
        except psycopg2.Error as e:
            if e.pgcode!='P0001': raise
            cur.execute('ROLLBACK TO SAVEPOINT atomic')
        cur.execute('RESET ROLE');cur.execute('SELECT accepted_at FROM organization_invites WHERE id=%s',(invite_id,));accepted=cur.fetchone()[0]
        cur.execute('SELECT count(*) FROM organization_members WHERE organization_id=%s AND user_id=%s',(ids['orgB'],ids['staffA']));count=cur.fetchone()[0]
        return accepted is None and count==0, {'accepted':accepted,'membership_count':count}
    record('invite audit failure rolls back membership and acceptance',True,invite_failure_atomic)
    def expired():
        cur.execute("INSERT INTO patient_visits(organization_id,patient_id,patient_name,diagnosis) VALUES (%s,%s,'Synthetic A','Synthetic note') RETURNING id",(ids['orgA'],ids['patientA'])); return cur.fetchone() is None,{'expired_staff_clinical_write_allowed':True}

    def audit_null():
        cur.execute("INSERT INTO audit_log(organization_id,actor_id,action) VALUES (NULL,%s,'synthetic-fake-admin-event') RETURNING id",(ids['ownerB'],)); return cur.fetchone() is None,{'null_org_spoofed_actor_inserted':True}
    record('staff inserts global audit record with another actor',True,audit_null,denied=True)
    for field,value in [('organization_id',ids['orgB']),('domain_status','verified'),('domain_verified_at','2030-01-01'),('suspended_at','2030-01-01'),('is_published',False),('wa_session_id','FOREIGN_SESSION'),('wa_status','connected'),('gsc_verified',True),('suspended_reason','Forged suspension')]:
        def clinic_privileged(f=field,v=value):
            cur.execute(f'UPDATE clinics SET {f}=%s WHERE id=%s RETURNING id',(v,ids['clinicA']))
            return cur.fetchone() is None, {'field':f}
        record('clinic authority staff cannot change '+field,True,clinic_privileged,denied=True)
    for field,value in [('wa_session_id','FORGED_SESSION'),('wa_status','connected'),('gsc_verified',True),('suspended_reason','Forged suspension')]:
        def forged_clinic_insert(f=field,v=value):
            cur.execute('RESET ROLE')
            cur.execute("INSERT INTO organizations(slug,name) VALUES (%s,'Synthetic authority insert') RETURNING id",('synthetic-'+str(uuid.uuid4()),)); org=cur.fetchone()[0]
            cur.execute('SET ROLE authenticated')
            cur.execute(f'INSERT INTO clinics(organization_id,owner_id,slug,{f}) VALUES (%s,%s,%s,%s) RETURNING id',(org,ids['staffA'],'synthetic-'+str(uuid.uuid4()),v))
            return cur.fetchone() is None, {'inserted_field':f}
        record('clinic authority insert cannot forge '+field,True,forged_clinic_insert,denied=True)
    def clinic_safe_edit():
        cur.execute("UPDATE clinics SET clinic_name='Synthetic reception edit' WHERE id=%s RETURNING clinic_name",(ids['clinicA'],))
        return cur.fetchone()[0]=='Synthetic reception edit', {}
    record('clinic authority reception safe profile edit remains permitted',True,clinic_safe_edit)
    def clinic_admin_publish():
        actor('ownerA')
        cur.execute('UPDATE clinics SET is_published=false WHERE id=%s RETURNING is_published',(ids['clinicA'],))
        return cur.fetchone()[0] is False, {}
    record('clinic authority owner publishing remains permitted',True,clinic_admin_publish)
    actor('staffA')
    def clinic_service():
        cur.execute('RESET ROLE');cur.execute('SET ROLE service_role')
        cur.execute("UPDATE clinics SET wa_session_id='SYNTHETIC_TRUSTED' WHERE id=%s RETURNING wa_session_id",(ids['clinicA'],))
        return cur.fetchone()[0]=='SYNTHETIC_TRUSTED', {}
    record('clinic authority trusted service role remains permitted',True,clinic_service)
    def forged_role_claim():
        cur.execute("SELECT set_config('request.jwt.claim.role','service_role',true)")
        cur.execute("UPDATE clinics SET wa_session_id='SYNTHETIC_FORGED' WHERE id=%s RETURNING id",(ids['clinicA'],))
        return cur.fetchone() is None, {}
    record('clinic authority JWT role claim cannot confer DB service authority',True,forged_role_claim,denied=True)
    def audit_actor():
        cur.execute("INSERT INTO audit_log(organization_id,actor_id,action) VALUES (%s,%s,'synthetic-spoof') RETURNING id",(ids['orgA'],ids['ownerB']))
        return cur.fetchone() is None, {}
    record('audit own tenant actor spoof denied',True,audit_actor,denied=True)
    def finance_actor():
        cur.execute("INSERT INTO finance_audit(organization_id,actor_id,action,entity_type) VALUES (%s,%s,'synthetic-spoof','expense') RETURNING id",(ids['orgA'],ids['ownerB']))
        return cur.fetchone() is None, {}
    record('finance audit actor spoof denied',True,finance_actor,denied=True)
    def own_audit():
        cur.execute("INSERT INTO audit_log(organization_id,actor_id,action) VALUES (%s,%s,'synthetic-authorized') RETURNING id",(ids['orgA'],ids['staffA']))
        return cur.fetchone() is not None, {}
    record('audit authorized own tenant append succeeds',True,own_audit)
    def global_audit_read():
        cur.execute('RESET ROLE');cur.execute("INSERT INTO audit_log(action) VALUES ('synthetic-global') RETURNING id"); rowid=cur.fetchone()[0];cur.execute('SET ROLE authenticated')
        cur.execute('SELECT id FROM audit_log WHERE id=%s',(rowid,));return cur.fetchone() is None, {}
    record('audit global read denied',True,global_audit_read)
    def patient_crud():
        cur.execute("INSERT INTO patients(organization_id,clinic_id,name) VALUES (%s,%s,'Synthetic CRUD') RETURNING id",(ids['orgA'],ids['clinicA'])); pid=cur.fetchone()[0]
        cur.execute("UPDATE patients SET name='Synthetic edited' WHERE id=%s RETURNING name",(pid,)); updated=cur.fetchone()[0]
        cur.execute('DELETE FROM patients WHERE id=%s RETURNING id',(pid,)); deleted=cur.fetchone()[0]
        return updated=='Synthetic edited' and deleted==pid, {}
    record('reception authorized same-tenant patient CRUD succeeds',True,patient_crud)
    def payment_legit():
        cur.execute("INSERT INTO patient_invoices(organization_id,patient_id,patient_name,invoice_number,total,status) VALUES (%s,%s,'Synthetic A','SYN-A-1',100,'sent') RETURNING id",(ids['orgA'],ids['patientA'])); iid=cur.fetchone()[0]
        cur.execute('INSERT INTO patient_payments(organization_id,invoice_id,amount) VALUES (%s,%s,100) RETURNING id',(ids['orgA'],iid)); pid=cur.fetchone()[0]
        cur.execute('SELECT amount_paid,status FROM patient_invoices WHERE id=%s',(iid,)); paid,status=cur.fetchone()
        cur.execute('SELECT patient_id FROM finance_ledger WHERE payment_id=%s',(pid,)); patient=cur.fetchone()[0]
        cur.execute('DELETE FROM patient_payments WHERE id=%s',(pid,))
        cur.execute('SELECT amount_paid FROM patient_invoices WHERE id=%s',(iid,)); after=cur.fetchone()[0]
        return paid==100 and status=='paid' and str(patient)==ids['patientA'] and after==0, {}
    record('authorized payment settles own invoice and deletes correctly',True,payment_legit)
    def dispense_legit():
        cur.execute('RESET ROLE')
        cur.execute("INSERT INTO inventory_items(organization_id,name,quantity) VALUES (%s,'Synthetic A',10) RETURNING id",(ids['orgA'],)); item=cur.fetchone()[0]
        cur.execute("INSERT INTO pharmacy_batches(organization_id,item_id,batch_no,quantity) VALUES (%s,%s,'SYN-A',10) RETURNING id",(ids['orgA'],item)); batch=cur.fetchone()[0]
        cur.execute('SET ROLE authenticated')
        cur.execute("INSERT INTO pharmacy_sale_items(organization_id,sale_id,item_id,batch_id,drug_name,quantity,line_total) VALUES (%s,%s,%s,%s,'Synthetic A',2,20)",(ids['orgA'],ids['saleA'],item,batch))
        cur.execute('SELECT quantity FROM inventory_items WHERE id=%s',(item,)); stock=cur.fetchone()[0]
        cur.execute('SELECT quantity FROM pharmacy_batches WHERE id=%s',(batch,)); bstock=cur.fetchone()[0]
        cur.execute('SELECT total FROM pharmacy_sales WHERE id=%s',(ids['saleA'],)); total=cur.fetchone()[0]
        return stock==8 and bstock==8 and total==20, {}
    record('authorized dispensing atomically decrements own stock batch and totals',True,dispense_legit)
    def ledger_defense():
        # Isolate trigger defense from the new FK, using trusted fixture setup ONLY.
        cur.execute('RESET ROLE')
        cur.execute("SELECT t.tgname FROM pg_trigger t JOIN pg_constraint c ON c.oid=t.tgconstraint WHERE t.tgrelid='patient_payments'::regclass AND c.conname LIKE 'clinicx_tenant_%'")
        for (trigger,) in cur.fetchall():
            from psycopg2 import sql
            cur.execute(sql.SQL('ALTER TABLE patient_payments DISABLE TRIGGER {}').format(sql.Identifier(trigger)))
        cur.execute('SET ROLE authenticated')
        cur.execute('INSERT INTO patient_payments(organization_id,invoice_id,amount) VALUES (%s,%s,1) RETURNING id',(ids['orgA'],ids['invoiceB'])); pid=cur.fetchone()[0]
        cur.execute('SELECT patient_id FROM finance_ledger WHERE payment_id=%s',(pid,)); row=cur.fetchone()
        return row is None, {'foreign_patient_copied':row is not None}
    record('payment ledger trigger independently rejects foreign invoice',True,ledger_defense,denied=True)
    def legacy_ledger_delete():
        cur.execute('RESET ROLE')
        cur.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(ids['ownerB'],))
        cur.execute('INSERT INTO patient_payments(organization_id,invoice_id,amount) VALUES (%s,%s,1) RETURNING id',(ids['orgB'],ids['invoiceB']));pid=cur.fetchone()[0]
        cur.execute('DELETE FROM finance_ledger WHERE payment_id=%s',(pid,))
        cur.execute("SELECT t.tgname FROM pg_trigger t JOIN pg_constraint c ON c.oid=t.tgconstraint WHERE t.tgrelid='finance_ledger'::regclass AND c.conname='clinicx_tenant_finance_ledger_payment_id'")
        for (trigger,) in cur.fetchall():
            from psycopg2 import sql
            cur.execute(sql.SQL('ALTER TABLE finance_ledger DISABLE TRIGGER {}').format(sql.Identifier(trigger)))
        cur.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(ids['ownerA'],))
        cur.execute('INSERT INTO finance_ledger(organization_id,payment_id,net_amount) VALUES (%s,%s,1) RETURNING id',(ids['orgA'],pid));lid=cur.fetchone()[0]
        actor('ownerB');cur.execute('DELETE FROM patient_payments WHERE id=%s',(pid,))
        cur.execute('RESET ROLE');cur.execute('SELECT id FROM finance_ledger WHERE id=%s',(lid,));row=cur.fetchone()
        return row is not None, {'foreign_legacy_ledger_preserved':row is not None}
    record('payment delete trigger does not erase foreign legacy ledger',True,legacy_ledger_delete)
    actor('staffA')
    def parent_delete_semantics():
        actor('ownerA')
        cur.execute("INSERT INTO patients(organization_id,name) VALUES (%s,'Synthetic deletion parent') RETURNING id",(ids['orgA'],));pid=cur.fetchone()[0]
        cur.execute("INSERT INTO prescriptions(organization_id,patient_id,patient_name) VALUES (%s,%s,'Synthetic delete') RETURNING id",(ids['orgA'],pid));rid=cur.fetchone()[0]
        cur.execute('DELETE FROM patients WHERE id=%s',(pid,))
        cur.execute('SELECT organization_id,patient_id FROM prescriptions WHERE id=%s',(rid,));org,parent=cur.fetchone()
        return str(org)==ids['orgA'] and parent is None, {}
    record('parent deletion keeps tenant and original nullable patient semantics',True,parent_delete_semantics)
    actor('staffA')
    def foreign_ledger_patient():
        cur.execute('INSERT INTO finance_ledger(organization_id,patient_id,entry_type,net_amount) VALUES (%s,%s,\'revenue\',1) RETURNING id',(ids['orgA'],ids['patientB']))
        return cur.fetchone() is None, {'foreign_patient_link_inserted':True}
    record('finance ledger foreign patient link denied',True,foreign_ledger_patient,denied=True)
    def oversell():
        cur.execute('RESET ROLE')
        cur.execute("INSERT INTO inventory_items(organization_id,name,quantity) VALUES (%s,'Synthetic low stock',1) RETURNING id",(ids['orgA'],)); item=cur.fetchone()[0]
        cur.execute('SET ROLE authenticated')
        cur.execute("INSERT INTO pharmacy_sale_items(organization_id,sale_id,item_id,drug_name,quantity) VALUES (%s,%s,%s,'Synthetic oversell',2) RETURNING id",(ids['orgA'],ids['saleA'],item))
        return cur.fetchone() is None, {'oversell_accepted':True}
    record('dispensing rejects insufficient stock',True,oversell,denied=True)
    def legacy_preserved():
        cur.execute('RESET ROLE');cur.execute('SELECT organization_id,clinic_id,name FROM patients WHERE id=%s',(legacy_id,)); row=cur.fetchone();cur.execute('SET ROLE authenticated')
        return row is not None and str(row[0])==ids['orgA'] and str(row[1])==ids['clinicB'] and row[2]=='Synthetic legacy mixed link', {}
    record('forward migration preserves legacy mixed patient unchanged',True,legacy_preserved)
    cur.execute('RESET ROLE')
    output={'environment':'PostgreSQL 17 isolated synthetic schema; not full Supabase migration replay','source_fragments':applied,'results':results,'summary':{'total':len(results),'pass':sum(r['result']=='PASS' for r in results),'fail':sum(r['result']=='FAIL' for r in results),'error':sum(r['result']=='ERROR' for r in results)}}
    if args.output: args.output.write_text(json.dumps(output,indent=2))
    print(json.dumps(output,indent=2))
    con.close()
finally:
    subprocess.run([str(BIN/'pg_ctl'),'-D',str(data),'-m','fast','-w','stop'],check=True,stdout=subprocess.DEVNULL)
    print('Synthetic cluster stopped; no TCP listener; scratch cluster retained for reproducibility:',work)

sys.exit(1 if not results or any(r['result'] != 'PASS' for r in results) else 0)
