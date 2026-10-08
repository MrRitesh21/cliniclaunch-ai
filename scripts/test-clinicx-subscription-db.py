"""Synthetic selected-schema PostgreSQL regression; no env/remote DSN reads."""
import os
import json
import pathlib
import shutil
import subprocess
import tempfile
import unittest
import uuid
from datetime import timedelta
import psycopg2

ROOT = pathlib.Path(__file__).resolve().parents[1]
BIN = pathlib.Path(os.environ.get('PG_BIN', '/opt/homebrew/opt/postgresql@17/bin'))
SCRATCH = pathlib.Path(os.environ['TMPDIR'])

class SubscriptionDB(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.work = pathlib.Path(tempfile.mkdtemp(prefix='clinicx-sub-', dir=SCRATCH))
        cls.socket = cls.work / 'socket'
        cls.socket.mkdir()
        cls.data = cls.work / 'data'
        env = dict(os.environ, LC_ALL='C')
        subprocess.run([str(BIN/'initdb'), '-D', str(cls.data), '-A', 'trust', '--no-locale', '-E', 'UTF8'], check=True, stdout=subprocess.DEVNULL, env=env)
        subprocess.run([str(BIN/'pg_ctl'), '-D', str(cls.data), '-l', str(cls.work/'postgres.log'), '-o', f"-k {cls.socket} -c listen_addresses='' -p 55447", '-w', 'start'], check=True, stdout=subprocess.DEVNULL, env=env)
        cls.addClassCleanup(cls.stop_cluster)
        cls.con = psycopg2.connect(host=str(cls.socket), port=55447, dbname='postgres', user=os.environ['USER'])
        cls.con.autocommit = True
        cls.c = cls.con.cursor()
        cls.c.execute("""CREATE EXTENSION pgcrypto; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
          CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),full_name text);
          CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
          GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
          CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
          CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('sub',auth.uid(),'email',current_setting('request.jwt.claim.email',true)) $$;
          CREATE TABLE public.user_roles(user_id uuid, role text); GRANT SELECT ON user_roles TO authenticated;
          CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;""")
        def apply(prefix, start=0, end=None):
            p = next((ROOT/'supabase/migrations').glob(prefix+'*.sql'))
            cls.c.execute('\n'.join(p.read_text().splitlines()[start:end]))
        apply('20260621120020_', 23)  # selected tenant schema, never destructive preamble
        apply('20260621120253_')
        apply('20260628143853_')
        apply('20260628144109_')
        apply('20260628164219_')
        apply('20260703054900_')
        apply('20260726150100_')
        apply('20260726150200_')
        apply('20260628163743_', 89, 113)
        apply('20260726090000_', 0, 22)
        cls.c.execute('CREATE FUNCTION public.is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$')
        apply('20260925040251_')
        apply('20261007120000_')  # invitation/RBAC authority from the security workstream
        # Simulated upgrade preserves ambiguous legacy grants, valid periods and IDs.
        cls.legacy_org=str(uuid.uuid4())
        cls.c.execute("INSERT INTO organizations(id,slug,name) VALUES(%s,'synthetic-legacy','Legacy Clinic')",(cls.legacy_org,))
        cls.c.execute("INSERT INTO subscriptions(organization_id,plan_id,status,trial_ends_at,current_period_end,razorpay_subscription_id) VALUES(%s,'enterprise','active',now()+interval '10 years',now()+interval '50 days','synthetic-preserved-provider') RETURNING id,plan_id,status,trial_ends_at,current_period_end,razorpay_subscription_id",(cls.legacy_org,))
        cls.legacy_before=cls.c.fetchone()
        cls.c.execute("INSERT INTO patients(organization_id,name) VALUES(%s,'Synthetic legacy clinical record')",(cls.legacy_org,))
        for p in sorted((ROOT/'supabase/migrations').glob('2026100713*.sql')):
            cls.c.execute('BEGIN')
            cls.c.execute(p.read_text())
            cls.c.execute('COMMIT')
        print('Selected-schema harness; every new subscription migration executed in its own transaction.')

    @classmethod
    def stop_cluster(cls):
        if hasattr(cls,'con'): cls.con.close()
        subprocess.run([str(BIN/'pg_ctl'), '-D', str(cls.data), '-m', 'immediate', '-w', 'stop'], check=True, stdout=subprocess.DEVNULL)
        shutil.rmtree(cls.work)

    def setUp(self):
        self.c.execute('RESET ROLE')
        self.user = str(uuid.uuid4())
        self.c.execute('INSERT INTO auth.users(id) VALUES (%s)', (self.user,))
        self.c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)", (self.user,))
        self.c.execute('SET ROLE authenticated')

    def provision(self):
        self.c.execute("SELECT public.clinicx_provision_trial(%s,'Synthetic Clinic','Synthetic Doctor','clinic')", ('s-'+self.user,))
        return self.c.fetchone()[0]

    def test_atomic_free_trial_has_exact_utc_duration(self):
        self.c.execute("SELECT to_regprocedure('public.clinicx_provision_trial(text,text,text,text)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'atomic server-owned free trial provisioning is missing')
        result = self.provision()
        self.c.execute('SELECT trial_started_at,trial_ends_at,grace_ends_at FROM subscriptions WHERE organization_id=%s', (result['organization_id'],))
        start, end, grace = self.c.fetchone()
        self.assertEqual(end-start, timedelta(days=30))
        self.assertEqual(grace-end, timedelta(days=7))
        self.c.execute('SELECT count(*) FROM clinics WHERE organization_id=%s', (result['organization_id'],))
        self.assertEqual(self.c.fetchone()[0], 1)
        self.assertEqual(result, self.provision(), 'retry must return the same trial, not extend it')
        self.c.execute('SELECT count(*) FROM subscription_events WHERE organization_id=%s', (result['organization_id'],))
        self.assertEqual(self.c.fetchone()[0], 1)

    def travel(self, org, age_days):
        self.c.execute('RESET ROLE')
        self.c.execute('ALTER TABLE subscriptions DISABLE TRIGGER clinicx_immutable_trial')
        self.c.execute("UPDATE subscriptions SET trial_started_at=now()-(%s*interval '1 day'),trial_ends_at=now()+((30-%s)*interval '1 day'),grace_ends_at=now()+((37-%s)*interval '1 day'),current_period_start=now()-(%s*interval '1 day'),current_period_end=now()+((30-%s)*interval '1 day') WHERE organization_id=%s", (age_days,age_days,age_days,age_days,age_days,org))
        self.c.execute('ALTER TABLE subscriptions ENABLE TRIGGER clinicx_immutable_trial')
        self.c.execute('SET ROLE authenticated')

    def denied(self, sql, args=()):
        with self.assertRaises(psycopg2.Error) as raised:
            self.c.execute(sql, args)
        self.assertEqual(raised.exception.pgcode, '42501')

    def test_core_clinical_writes_then_grace_denies_writes_but_retains_reads(self):
        org = self.provision()['organization_id']
        self.c.execute("INSERT INTO patients(organization_id,name) VALUES(%s,'Synthetic Patient') RETURNING id", (org,))
        patient = self.c.fetchone()[0]
        self.c.execute("INSERT INTO appointments(organization_id,patient_id,patient_name,appointment_date,appointment_time) VALUES(%s,%s,'Synthetic Patient',current_date,'10:00')", (org,patient))
        self.c.execute("INSERT INTO prescriptions(organization_id,patient_id,patient_name) VALUES(%s,%s,'Synthetic Patient')", (org,patient))
        self.c.execute("INSERT INTO patient_invoices(organization_id,patient_id,patient_name,invoice_number,total) VALUES(%s,%s,'Synthetic Patient','SYN-1',150) RETURNING id", (org,patient))
        invoice = self.c.fetchone()[0]
        self.c.execute("INSERT INTO patient_payments(organization_id,invoice_id,amount) VALUES(%s,%s,150)", (org,invoice))
        self.travel(org,30)
        self.denied("INSERT INTO patients(organization_id,name) VALUES(%s,'Forbidden')", (org,))
        self.denied('UPDATE prescriptions SET notes=\'Forbidden\' WHERE organization_id=%s', (org,))
        self.c.execute('SELECT count(*) FROM patients WHERE organization_id=%s', (org,))
        self.assertEqual(self.c.fetchone()[0],1)
        self.travel(org,37)
        self.c.execute('SELECT count(*) FROM patients WHERE organization_id=%s', (org,))
        self.assertEqual(self.c.fetchone()[0],0,'post-grace operational reads must be closed')

    def test_snapshot_usage_is_real_and_export_remains_authorized_after_grace(self):
        self.c.execute("SELECT to_regprocedure('public.clinicx_subscription_snapshot(uuid)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'central entitlement/usage RPC missing')
        org = self.provision()['organization_id']
        self.c.execute("INSERT INTO patients(organization_id,name) VALUES(%s,'Synthetic Export Patient')", (org,))
        self.c.execute('SELECT public.clinicx_subscription_snapshot(%s)', (org,))
        snapshot = self.c.fetchone()[0]
        self.assertEqual(snapshot['usage']['patients'],1)
        self.assertEqual(snapshot['usage']['staff'],0,'owner/doctor must not count as reception staff')
        self.assertEqual(snapshot['usage']['doctors'],1)
        self.assertEqual(snapshot['effective_state'],'trialing')
        self.assertTrue(snapshot['can_write'])
        self.travel(org,37)
        self.c.execute("SELECT public.clinicx_export_page(%s,'patients',NULL,100)", (org,))
        export = self.c.fetchone()[0]
        self.assertEqual(len(export['records']),1)
        if os.environ.get('CLINICX_SUBSCRIPTION_CAPTURE'):
            pathlib.Path(os.environ['CLINICX_SUBSCRIPTION_CAPTURE']).write_text(json.dumps({'snapshot':snapshot,'export':export}))
        self.denied("SELECT public.clinicx_export_page(%s,'patients',NULL,100)", (str(uuid.uuid4()),))
        self.denied('SELECT public.clinicx_subscription_snapshot(%s)', (str(uuid.uuid4()),))

    def test_expired_snapshot_is_aggregate_only_and_settings_export_excludes_credentials(self):
        org=self.provision()['organization_id']
        self.c.execute("INSERT INTO patients(organization_id,name) VALUES(%s,'SYNTHETIC-PHI-MARKER')",(org,))
        self.c.execute('RESET ROLE')
        self.c.execute('ALTER TABLE clinics ADD COLUMN IF NOT EXISTS whatsapp_access_token text')
        self.c.execute("UPDATE clinics SET whatsapp_access_token='SYNTHETIC-SECRET-MARKER' WHERE organization_id=%s",(org,))
        self.c.execute('SET ROLE authenticated')
        self.travel(org,37)
        self.c.execute('SELECT public.clinicx_subscription_snapshot(%s)',(org,))
        snap=self.c.fetchone()[0]
        self.assertEqual(snap['effective_state'],'suspended')
        self.assertFalse(snap['can_read'])
        self.assertFalse(snap['can_write'])
        self.assertTrue(snap['can_export'])
        self.assertEqual(snap['features'],[])
        self.assertNotIn('SYNTHETIC-PHI-MARKER',json.dumps(snap))
        self.c.execute("SELECT public.clinicx_export_page(%s,'clinics',NULL,100)",(org,))
        settings=self.c.fetchone()[0]['records'][0]
        self.assertEqual(settings['organization_id'],org)
        self.assertIn('working_hours',settings)
        self.assertNotIn('whatsapp_access_token',settings)
        self.assertNotIn('SYNTHETIC-SECRET-MARKER',json.dumps(settings))
        for table in ['subscription_outbox','organization_module_overrides','auth.users','clinic_domain_secrets']:
            with self.subTest(table=table), self.assertRaises(psycopg2.Error) as raised:
                self.c.execute('SELECT public.clinicx_export_page(%s,%s,NULL,100)',(org,table))
            self.assertEqual(raised.exception.pgcode,'22023')

    def test_export_null_arguments_cannot_bypass_database_bounds(self):
        org=self.provision()['organization_id']
        for table,limit in [('patients',None),(None,100),('patients',0),('patients',501)]:
            with self.subTest(table=table,limit=limit):
                with self.assertRaises(psycopg2.Error) as raised:
                    self.c.execute('SELECT public.clinicx_export_page(%s,%s,NULL,%s)',(org,table,limit))
                self.assertEqual(raised.exception.pgcode,'22023')

    def test_idempotent_checkpoint_jobs_and_audited_expiry(self):
        self.c.execute("SELECT to_regprocedure('public.clinicx_run_trial_jobs(timestamp with time zone)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'durable idempotent trial lifecycle job missing')
        org = self.provision()['organization_id']
        self.c.execute('SELECT trial_started_at,trial_ends_at,grace_ends_at FROM subscriptions WHERE organization_id=%s',(org,))
        start,end,grace = self.c.fetchone()
        self.c.execute('RESET ROLE')
        for day in [7,15,21,25,28,30,37,40]:
            with self.subTest(day=day):
                self.c.execute('SELECT public.clinicx_run_trial_jobs(%s)',(start+timedelta(days=day),))
                self.c.execute('SELECT count(*) FROM subscription_events WHERE organization_id=%s',(org,))
                before = self.c.fetchone()[0]
                self.c.execute('SELECT public.clinicx_run_trial_jobs(%s)',(start+timedelta(days=day),))
                self.c.execute('SELECT count(*) FROM subscription_events WHERE organization_id=%s',(org,))
                self.assertEqual(self.c.fetchone()[0],before)
        self.c.execute("SELECT kind FROM subscription_events WHERE organization_id=%s AND event_key IN ('trial_expired','grace_period','suspended') ORDER BY effective_at,event_key",(org,))
        self.assertCountEqual([r[0] for r in self.c.fetchall()],['trial_expired','grace_period','suspended'])
        self.c.execute('SELECT trial_started_at,trial_ends_at,grace_ends_at,status FROM subscriptions WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchone(),(start,end,grace,'suspended'))
        self.c.execute("SELECT count(*) FROM subscription_outbox WHERE organization_id=%s AND kind LIKE 'trial_day_%%'",(org,))
        self.assertEqual(self.c.fetchone()[0],5)

    def test_snapshot_exposes_verified_membership_role(self):
        org=self.provision()['organization_id']
        self.c.execute('SELECT public.clinicx_subscription_snapshot(%s)',(org,))
        self.assertEqual(self.c.fetchone()[0].get('role'),'owner','access API needs verified RBAC, not a client-supplied role')

    def test_pending_invitation_is_reserved_and_acceptance_consumes_not_duplicates_seat(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        invited=str(uuid.uuid4())
        self.c.execute("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(%s,'staff@example.invalid',now())",(invited,))
        self.c.execute("ALTER TABLE subscriptions DISABLE TRIGGER ALL; UPDATE subscriptions SET status='active',plan_id='starter',access_source='verified_payment',current_period_end=now()+interval '1 year' WHERE organization_id=%s; ALTER TABLE subscriptions ENABLE TRIGGER ALL",(org,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute("INSERT INTO organization_invites(organization_id,email,role,invited_by) VALUES(%s,'staff@example.invalid','staff',%s) RETURNING token",(org,self.user))
        token=self.c.fetchone()[0]
        self.denied("INSERT INTO organization_invites(organization_id,email,role,invited_by) VALUES(%s,'another@example.invalid','staff',%s)",(org,self.user))
        self.c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(invited,))
        self.c.execute('SELECT public.accept_invite(%s)',(token,))
        self.assertEqual(str(self.c.fetchone()[0]),org)
        self.c.execute('SELECT public.clinicx_subscription_snapshot(%s)',(org,))
        usage=self.c.fetchone()[0]['usage']
        self.assertEqual(usage['staff'],1)
        self.assertEqual(usage['pending_staff_invites'],0)
        self.denied("INSERT INTO prescriptions(organization_id,patient_name) VALUES(%s,'No staff signing')",(org,))

    def test_trial_started_has_durable_outbox(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("SELECT count(*) FROM subscription_outbox WHERE organization_id=%s AND kind='trial_started'",(org,))
        self.assertEqual(self.c.fetchone()[0],1,'trial start notification must be durable and atomic')

    def test_price_preflight_reports_drift_without_rewriting_configuration(self):
        self.c.execute('RESET ROLE')
        self.c.execute("SELECT to_regprocedure('public.clinicx_pricing_preflight()')")
        self.assertIsNotNone(self.c.fetchone()[0],'read-only canonical price reconciliation RPC missing')
        self.c.execute('SELECT id,monthly_price,yearly_price FROM plans ORDER BY id')
        before=self.c.fetchall()
        self.c.execute('SELECT public.clinicx_pricing_preflight()')
        preflight=self.c.fetchone()[0]
        self.assertTrue(preflight['requires_live_provider_reconciliation'])
        self.assertEqual(len(preflight['plans']),4)
        by_id={p['plan_id']:p for p in preflight['plans']}
        self.assertEqual(by_id['growth']['required_monthly_inr'],2999)
        self.assertEqual(by_id['professional']['preferred_yearly_inr'],85990)
        self.c.execute('SELECT id,monthly_price,yearly_price FROM plans ORDER BY id')
        self.assertEqual(before,self.c.fetchall())

    def test_upgrade_preserves_legacy_period_provider_ids_and_clinical_rows(self):
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT id,plan_id,status,trial_ends_at,current_period_end,razorpay_subscription_id FROM subscriptions WHERE organization_id=%s',(self.legacy_org,))
        self.assertEqual(self.c.fetchone(),self.legacy_before)
        self.c.execute('SELECT trial_started_at,access_source FROM subscriptions WHERE organization_id=%s',(self.legacy_org,))
        self.assertEqual(self.c.fetchone(),(None,'legacy_unverified'))
        self.c.execute('SELECT count(*) FROM patients WHERE organization_id=%s',(self.legacy_org,))
        self.assertEqual(self.c.fetchone()[0],1)

    def test_direct_subscription_invoice_event_outbox_tampering_and_trial_extension_denied(self):
        org=self.provision()['organization_id']
        for sql in ["UPDATE subscriptions SET status='active',plan_id='enterprise' WHERE organization_id=%s",
                    "UPDATE subscriptions SET trial_ends_at=now()+interval '1 year' WHERE organization_id=%s",
                    "DELETE FROM subscriptions WHERE organization_id=%s",
                    "DELETE FROM invoices WHERE organization_id=%s",
                    "DELETE FROM subscription_events WHERE organization_id=%s",
                    "UPDATE subscription_outbox SET delivered_at=now() WHERE organization_id=%s"]:
            with self.subTest(sql=sql): self.denied(sql,(org,))
        self.denied("SELECT public.clinicx_run_trial_jobs(now()+interval '100 days')")
        self.c.execute('RESET ROLE')
        self.denied("UPDATE subscriptions SET trial_ends_at=now()+interval '1 year' WHERE organization_id=%s",(org,))

    def test_exact_backend_time_boundaries_and_paid_through_cancellation(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT trial_ends_at,grace_ends_at FROM subscriptions WHERE organization_id=%s',(org,))
        end,grace=self.c.fetchone()
        for at,state in [(end-timedelta(microseconds=1),'trialing'),(end,'grace_period'),(grace-timedelta(microseconds=1),'grace_period'),(grace,'suspended')]:
            self.c.execute('SELECT public.clinicx_effective_state(%s,%s)',(org,at))
            self.assertEqual(self.c.fetchone()[0],state)
        self.c.execute("UPDATE subscriptions SET status='cancelled',current_period_end=%s WHERE organization_id=%s",(grace,org))
        self.c.execute('SELECT public.clinicx_effective_state(%s,%s)',(org,end))
        self.assertEqual(self.c.fetchone()[0],'active')
        self.c.execute('SELECT public.clinicx_effective_state(%s,%s)',(org,grace))
        self.assertEqual(self.c.fetchone()[0],'suspended')

    def test_plan_catalog_limits_features_and_advisory_recommendations(self):
        org=self.provision()['organization_id']
        for plan,patients,staff,doctors,billing in [('starter',100,1,1,False),('growth',1000,5,1,True),('professional',None,20,None,True),('enterprise',None,None,None,True)]:
            with self.subTest(plan=plan):
                self.c.execute('RESET ROLE')
                self.c.execute("ALTER TABLE subscriptions DISABLE TRIGGER ALL; UPDATE subscriptions SET plan_id=%s,status='active',access_source='verified_payment',current_period_end=now()+interval '1 year' WHERE organization_id=%s; ALTER TABLE subscriptions ENABLE TRIGGER ALL",(plan,org))
                self.c.execute('SET ROLE authenticated')
                self.c.execute('SELECT public.clinicx_subscription_snapshot(%s)',(org,))
                snap=self.c.fetchone()[0]
                self.assertEqual(snap['limits'],{'patients':patients,'staff':staff,'doctors':doctors})
                self.assertEqual('billing' in snap['features'],billing)
        self.c.execute("INSERT INTO doctors(organization_id,name) VALUES(%s,'Second Synthetic Doctor')",(org,))
        self.c.execute('SELECT public.clinicx_subscription_snapshot(%s)',(org,))
        self.assertEqual(self.c.fetchone()[0]['recommendation']['plan_id'],'professional')

    def test_tenant_b_clinical_rows_and_export_are_denied_to_a(self):
        org=self.provision()['organization_id']
        other=str(uuid.uuid4())
        self.c.execute('RESET ROLE')
        self.c.execute('INSERT INTO auth.users(id) VALUES(%s)',(other,))
        self.c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(other,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute("SELECT public.clinicx_provision_trial(%s,'Tenant B','Doctor B','clinic')",('s-'+other,))
        org_b=self.c.fetchone()[0]['organization_id']
        self.c.execute("INSERT INTO patients(organization_id,name) VALUES(%s,'Synthetic B')",(org_b,))
        self.c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(self.user,))
        self.c.execute('SELECT count(*) FROM patients WHERE organization_id=%s',(org_b,))
        self.assertEqual(self.c.fetchone()[0],0)
        self.denied("INSERT INTO patients(organization_id,name) VALUES(%s,'Forbidden')",(org_b,))
        self.denied('SELECT public.clinicx_subscription_snapshot(%s)',(org_b,))
        self.denied("SELECT public.clinicx_export_page(%s,'patients',NULL,100)",(org_b,))

    def test_documented_module_override_is_preserved_without_becoming_paid_provenance(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("ALTER TABLE subscriptions DISABLE TRIGGER ALL; UPDATE subscriptions SET status='active',plan_id='starter',current_period_end=now()+interval '1 year' WHERE organization_id=%s; ALTER TABLE subscriptions ENABLE TRIGGER ALL",(org,))
        self.c.execute("INSERT INTO organization_module_overrides(organization_id,module_id,enabled,reason,updated_by) VALUES(%s,'finance',true,'Synthetic documented support grant',%s)",(org,self.user))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT public.clinicx_subscription_snapshot(%s)',(org,))
        snap=self.c.fetchone()[0]
        self.assertIn('billing',snap['features'],'legitimate documented overrides must survive canonical plan enforcement')
        self.assertNotEqual(snap['subscription']['access_source'],'verified_payment')
        self.c.execute("INSERT INTO patient_invoices(organization_id,patient_name,invoice_number,total) VALUES(%s,'Synthetic','OVERRIDE-1',50)",(org,))
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE organization_module_overrides SET enabled=false WHERE organization_id=%s AND module_id='finance'",(org,))
        self.c.execute('SET ROLE authenticated')
        self.denied("INSERT INTO patient_invoices(organization_id,patient_name,invoice_number,total) VALUES(%s,'Synthetic','OVERRIDE-2',50)",(org,))

    def test_override_denies_base_feature_and_cannot_reopen_expired_access(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("INSERT INTO organization_module_overrides(organization_id,module_id,enabled,reason,updated_by) VALUES(%s,'records',false,'Synthetic restriction',%s)",(org,self.user))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT public.clinicx_subscription_snapshot(%s)',(org,))
        self.assertNotIn('patients',self.c.fetchone()[0]['features'])
        self.denied("INSERT INTO patients(organization_id,name) VALUES(%s,'Denied override')",(org,))
        self.denied("UPDATE organization_module_overrides SET enabled=true WHERE organization_id=%s",(org,))
        self.travel(org,37)
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE organization_module_overrides SET enabled=true WHERE organization_id=%s",(org,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT public.clinicx_subscription_snapshot(%s)',(org,))
        snap=self.c.fetchone()[0]
        self.assertFalse(snap['can_write'])
        self.assertFalse(snap['can_read'])
        self.assertEqual(snap['features'],[])
        self.denied("INSERT INTO patients(organization_id,name) VALUES(%s,'Expired override')",(org,))

    def test_doctor_invite_quota_failure_rolls_back_and_self_insert_is_not_general_authority(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        invited=str(uuid.uuid4())
        self.c.execute("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(%s,'doctor@example.invalid',now())",(invited,))
        self.c.execute("ALTER TABLE subscriptions DISABLE TRIGGER ALL; UPDATE subscriptions SET status='active',plan_id='starter',current_period_end=now()+interval '1 year' WHERE organization_id=%s; ALTER TABLE subscriptions ENABLE TRIGGER ALL",(org,))
        self.c.execute("INSERT INTO organization_invites(organization_id,email,role,invited_by) VALUES(%s,'doctor@example.invalid','doctor',%s) RETURNING id,token",(org,self.user))
        invite,token=self.c.fetchone()
        self.c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(invited,))
        self.c.execute('SET ROLE authenticated')
        with self.assertRaises(psycopg2.Error) as raised: self.c.execute('SELECT public.accept_invite(%s)',(token,))
        self.assertIn('Doctor limit reached',str(raised.exception))
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT accepted_at FROM organization_invites WHERE id=%s',(invite,))
        self.assertIsNone(self.c.fetchone()[0])
        self.c.execute('SELECT count(*) FROM organization_members WHERE organization_id=%s AND user_id=%s',(org,invited))
        self.assertEqual(self.c.fetchone()[0],0)
        self.c.execute("ALTER TABLE subscriptions DISABLE TRIGGER ALL; UPDATE subscriptions SET plan_id='professional' WHERE organization_id=%s; ALTER TABLE subscriptions ENABLE TRIGGER ALL",(org,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT public.accept_invite(%s)',(token,))
        self.assertEqual(str(self.c.fetchone()[0]),org)
        self.denied("INSERT INTO doctors(organization_id,user_id,name) VALUES(%s,%s,'Direct self insert')",(org,invited))

    def test_concurrent_patient_admission_cannot_exceed_limit(self):
        import concurrent.futures
        import threading
        org=self.provision()['organization_id']
        self.c.execute("INSERT INTO patients(organization_id,name) SELECT %s,'Synthetic '||g FROM generate_series(1,99) g",(org,))
        self.c.execute('RESET ROLE')
        self.c.execute("ALTER TABLE subscriptions DISABLE TRIGGER ALL; UPDATE subscriptions SET status='active',plan_id='starter',access_source='verified_payment',current_period_end=now()+interval '1 year' WHERE organization_id=%s; ALTER TABLE subscriptions ENABLE TRIGGER ALL",(org,))
        barrier=threading.Barrier(2)
        def admit():
            conn=psycopg2.connect(host=str(self.socket),port=55447,dbname='postgres',user=os.environ['USER'])
            try:
                cur=conn.cursor()
                cur.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(self.user,))
                cur.execute('SET ROLE authenticated')
                barrier.wait(timeout=10)
                cur.execute("INSERT INTO patients(organization_id,name) VALUES(%s,'Concurrent Synthetic')",(org,))
                conn.commit()
                return 'inserted'
            except psycopg2.Error as exc:
                conn.rollback()
                return exc.pgcode
            finally: conn.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            self.assertCountEqual(list(pool.map(lambda _:admit(),range(2))),['inserted','42501'])
        self.c.execute('SELECT count(*) FROM patients WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchone()[0],100)

if __name__ == '__main__':
    unittest.main(verbosity=2)
