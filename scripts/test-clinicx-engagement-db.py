"""Real isolated PostgreSQL; selected schema, no project env/DSN or transport."""
import importlib.util
import pathlib
import unittest
from datetime import timedelta
import uuid
import psycopg2

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('foundation', ROOT/'scripts/test-clinicx-subscription-db.py')
foundation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(foundation)

class EngagementDB(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        foundation.SubscriptionDB.setUpClass.__func__(cls)
        cls.c.execute((ROOT/'supabase/migrations/20260813071033_916a67a7-dbcf-48eb-a6ab-c654e0450749.sql').read_text())
        for p in sorted((ROOT/'supabase/migrations').glob('2026100716*.sql')):
            cls.c.execute(p.read_text())
    stop_cluster = classmethod(foundation.SubscriptionDB.stop_cluster.__func__)
    setUp = foundation.SubscriptionDB.setUp
    provision = foundation.SubscriptionDB.provision
    denied = foundation.SubscriptionDB.denied
    travel = foundation.SubscriptionDB.travel

    def test_factual_window_excludes_pretrial_and_future_records(self):
        self.c.execute("SELECT to_regprocedure('public.clinicx_trial_engagement(uuid)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'trial-window engagement RPC is missing')
        org = self.provision()['organization_id']
        self.c.execute("INSERT INTO patients(organization_id,name,created_at) VALUES(%s,'Synthetic before',now()-interval '1 day'),(%s,'Synthetic now',now()),(%s,'Synthetic future',now()+interval '1 day')",(org,org,org))
        self.c.execute('SELECT public.clinicx_trial_engagement(%s)',(org,))
        dto = self.c.fetchone()[0]
        self.assertEqual(dto['usage']['patients'],1)
        self.assertEqual(dto['usage']['window'],'trial')
        self.assertEqual(dto['usage']['days_active'],1)
        self.assertIsNone(dto['usage']['completed_visits'])
        self.assertNotIn('Synthetic',str(dto))
        self.denied('SELECT public.clinicx_trial_engagement(%s)',(str(uuid.uuid4()),))

    def test_exact_checkpoint_boundaries_and_lifecycle_are_repeat_safe(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT trial_started_at,trial_ends_at,grace_ends_at FROM subscriptions WHERE organization_id=%s',(org,))
        start,end,grace=self.c.fetchone()
        for day in [0,7,15,21,25,28,30,37]:
            at=start+timedelta(days=day)
            self.c.execute('SELECT clinicx_run_trial_jobs(%s)',(at,))
            self.c.execute('SELECT count(*) FROM subscription_events WHERE organization_id=%s',(org,))
            before=self.c.fetchone()[0]
            self.c.execute('SELECT clinicx_run_trial_jobs(%s)',(at,))
            self.c.execute('SELECT count(*) FROM subscription_events WHERE organization_id=%s',(org,))
            self.assertEqual(self.c.fetchone()[0],before)
            self.c.execute('SELECT clinicx_effective_state(%s,%s)',(org,at))
            self.assertEqual(self.c.fetchone()[0],'trialing' if day<30 else 'grace_period' if day<37 else 'suspended')
        self.c.execute("SELECT details->'usage'->>'window',effective_at,details->>'snapshot_at' FROM subscription_events WHERE organization_id=%s AND kind LIKE 'trial_day_%%'",(org,))
        checkpoints=self.c.fetchall()
        self.assertEqual(len(checkpoints),5)
        self.assertTrue(all(row[0]=='trial' for row in checkpoints))
        self.c.execute('SELECT trial_started_at,trial_ends_at,grace_ends_at FROM subscriptions WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchone(),(start,end,grace))

    def test_inbox_and_consented_delivery_are_durable_lease_fenced(self):
        self.c.execute("SELECT to_regprocedure('public.clinicx_prepare_notification_delivery(integer)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'durable delivery materializer missing')
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE auth.users SET email='owner@example.invalid',email_confirmed_at=now() WHERE id=%s",(self.user,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_set_engagement_email(%s,true)',(org,))
        self.c.execute('RESET ROLE')
        for _ in range(2): self.c.execute('SELECT clinicx_prepare_notification_delivery(50)')
        self.c.execute('SELECT count(*) FROM notifications WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchone()[0],1)
        self.c.execute('SELECT clinicx_claim_notification_delivery(50)')
        jobs=self.c.fetchone()[0]
        self.assertEqual(len(jobs),1)
        job=jobs[0]
        self.c.execute('SELECT clinicx_claim_notification_delivery(50)')
        self.assertEqual(self.c.fetchone()[0],[])
        self.c.execute('SELECT clinicx_finish_notification_delivery(%s,%s,true)',(job['id'],str(uuid.uuid4())))
        self.assertFalse(self.c.fetchone()[0])
        self.c.execute('SELECT clinicx_finish_notification_delivery(%s,%s,false)',(job['id'],job['lease_token']))
        self.assertTrue(self.c.fetchone()[0])
        self.c.execute('SELECT available_at>now(),attempts,last_error FROM clinicx_notification_delivery WHERE id=%s',(job['id'],))
        self.assertEqual(self.c.fetchone(),(True,1,'delivery_failed'))
        self.c.execute("UPDATE clinicx_notification_delivery SET available_at=now() WHERE id=%s",(job['id'],))
        self.c.execute('SELECT clinicx_claim_notification_delivery(50)')
        retry=self.c.fetchone()[0][0]
        self.assertEqual(retry['idempotency_key'],job['idempotency_key'])
        self.c.execute('SELECT clinicx_finish_notification_delivery(%s,%s,true)',(retry['id'],retry['lease_token']))
        self.assertTrue(self.c.fetchone()[0])
        self.c.execute('SELECT delivered_at IS NOT NULL FROM subscription_outbox WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchone()[0],True)
        self.c.execute('SET ROLE authenticated')
        self.denied('SELECT clinicx_claim_notification_delivery(50)')
        self.denied('SELECT clinicx_set_engagement_email(%s,true)',(str(uuid.uuid4()),))

    def test_real_worker_orchestrates_local_database_with_provider_double(self):
        import http.server
        import threading
        import subprocess
        import os
        import json
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE auth.users SET email='integration@example.invalid',email_confirmed_at=now() WHERE id=%s",(self.user,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_set_engagement_email(%s,true)',(org,))
        self.c.execute('RESET ROLE')
        owner=self
        allowed={'expire_lapsed_subscriptions':[], 'clinicx_prepare_notification_delivery':['p_limit'], 'clinicx_claim_notification_delivery':['p_limit'], 'clinicx_finish_notification_delivery':['p_id','p_token','p_success']}
        class Bridge(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_POST(self):
                payload=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                name=payload['name']
                if name not in allowed: self.send_error(403); return
                args=[payload['args'][key] for key in allowed[name]]
                conn=psycopg2.connect(host=str(owner.socket),port=55447,dbname='postgres',user=os.environ['USER'])
                try:
                    conn.autocommit=True
                    cur=conn.cursor()
                    cur.execute('SET ROLE service_role')
                    cur.execute('SELECT '+name+'('+','.join(['%s']*len(args))+')',args)
                    result=cur.fetchone()[0]
                    self.send_response(200);self.end_headers();self.wfile.write(json.dumps(result).encode())
                finally: conn.close()
        bridge=http.server.HTTPServer(('127.0.0.1',0),Bridge)
        thread=threading.Thread(target=bridge.serve_forever,daemon=True);thread.start()
        try:
            result=subprocess.run(['node','scripts/test-clinicx-engagement.cjs'],cwd=ROOT,env={**os.environ,'CLINICX_ENGAGEMENT_FIXTURE_URL':f'http://127.0.0.1:{bridge.server_port}'},capture_output=True,text=True,timeout=45)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        finally: bridge.shutdown();bridge.server_close();thread.join()
        self.c.execute('SELECT delivered_at IS NOT NULL FROM subscription_outbox WHERE organization_id=%s',(org,))
        self.assertTrue(self.c.fetchone()[0])

    def test_legacy_all_time_checkpoint_is_not_mislabeled_as_trial_window(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("INSERT INTO subscription_events(organization_id,subscription_id,event_key,kind,effective_at,details) SELECT organization_id,id,'trial_day_7','trial_day_7',trial_started_at+interval '7 days','{\"usage\":{\"window\":\"all_time\",\"patients\":999}}'::jsonb FROM subscriptions WHERE organization_id=%s",(org,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_trial_engagement(%s)',(org,))
        dto=self.c.fetchone()[0]
        self.assertEqual(dto['usage']['window'],'trial')
        self.assertIsNone(dto['checkpoints'][0]['usage'])
        self.c.execute('RESET ROLE')
        self.c.execute("SELECT details->'usage'->>'window' FROM subscription_events WHERE organization_id=%s AND kind='trial_day_7'",(org,))
        self.assertEqual(self.c.fetchone()[0],'all_time')

    def test_invoice_totals_and_payment_collections_use_real_distinct_windows(self):
        org=self.provision()['organization_id']
        self.c.execute("INSERT INTO patient_invoices(organization_id,patient_name,invoice_number,total,created_at) VALUES(%s,'Synthetic','ENG-OLD',900,now()-interval '1 day') RETURNING id",(org,))
        old=self.c.fetchone()[0]
        self.c.execute("INSERT INTO patient_invoices(organization_id,patient_name,invoice_number,total) VALUES(%s,'Synthetic','ENG-NOW',1200) RETURNING id",(org,))
        new=self.c.fetchone()[0]
        self.c.execute("INSERT INTO patient_payments(organization_id,invoice_id,amount,paid_at) VALUES(%s,%s,100,now()-interval '1 day'),(%s,%s,200,now()),(%s,%s,300,now()+interval '1 day')",(org,new,org,old,org,new))
        self.c.execute('SELECT clinicx_trial_engagement(%s)',(org,))
        usage=self.c.fetchone()[0]['usage']
        self.assertEqual(usage['invoices'],1)
        self.assertEqual(usage['invoiced_inr'],1200)
        self.assertEqual(usage['collected_inr'],200)

    def test_concurrent_claims_do_not_duplicate_email_and_expired_lease_recovers(self):
        import concurrent.futures
        import threading
        import os
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE auth.users SET email='concurrent@example.invalid',email_confirmed_at=now() WHERE id=%s",(self.user,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_set_engagement_email(%s,true)',(org,))
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT clinicx_prepare_notification_delivery(100)')
        barrier=threading.Barrier(2)
        def claim():
            conn=psycopg2.connect(host=str(self.socket),port=55447,dbname='postgres',user=os.environ['USER'])
            try:
                conn.autocommit=True; cur=conn.cursor();cur.execute('SET ROLE service_role');barrier.wait(timeout=10)
                cur.execute('SELECT clinicx_claim_notification_delivery(50)');return cur.fetchone()[0]
            finally: conn.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            batches=list(pool.map(lambda _:claim(),range(2)))
        jobs=[job for batch in batches for job in batch]
        self.assertEqual(len(jobs),1)
        job=jobs[0]
        self.c.execute("UPDATE clinicx_notification_delivery SET leased_until=now()-interval '1 second' WHERE id=%s",(job['id'],))
        self.c.execute('SELECT clinicx_claim_notification_delivery(50)')
        recovered=self.c.fetchone()[0][0]
        self.assertEqual(recovered['idempotency_key'],job['idempotency_key'])
        self.assertNotEqual(recovered['lease_token'],job['lease_token'])
        self.c.execute('SELECT clinicx_finish_notification_delivery(%s,%s,true)',(job['id'],job['lease_token']))
        self.assertFalse(self.c.fetchone()[0])
        self.c.execute('SELECT clinicx_finish_notification_delivery(%s,%s,true)',(recovered['id'],recovered['lease_token']))
        self.assertTrue(self.c.fetchone()[0])

    def test_activation_events_are_database_derived_repeat_safe_and_phi_free(self):
        org=self.provision()['organization_id']
        self.c.execute("INSERT INTO patients(organization_id,name) VALUES(%s,'SYNTHETIC-PHI-A'),(%s,'SYNTHETIC-PHI-B')",(org,org))
        self.c.execute('SELECT clinicx_trial_engagement(%s)',(org,))
        dto=self.c.fetchone()[0]
        first=[e for e in dto['activation'] if e['kind']=='first_patient']
        self.assertEqual(len(first),1)
        self.assertNotIn('SYNTHETIC-PHI',str(dto))
        self.denied("INSERT INTO subscription_events(organization_id,subscription_id,event_key,kind,effective_at) SELECT organization_id,id,'fake','first_patient',now() FROM subscriptions WHERE organization_id=%s",(org,))

    def test_stale_marketing_and_revoked_consent_are_suppressed(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE auth.users SET email='revoked@example.invalid',email_confirmed_at=now() WHERE id=%s",(self.user,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_set_engagement_email(%s,true)',(org,))
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT clinicx_prepare_notification_delivery(100)')
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_set_engagement_email(%s,false)',(org,))
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT clinicx_claim_notification_delivery(50)')
        self.assertEqual(self.c.fetchone()[0],[])
        self.c.execute("UPDATE subscriptions SET status='active',access_source='verified_payment',current_period_end=now()+interval '1 year' WHERE organization_id=%s",(org,))
        self.c.execute('SELECT clinicx_run_trial_jobs(now()+interval \'28 days\')')
        self.c.execute('SELECT clinicx_prepare_notification_delivery(100)')
        self.c.execute('SELECT count(*) FROM notifications WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchone()[0],1)

    def test_uncertain_email_after_idempotency_window_requires_review(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE auth.users SET email='uncertain@example.invalid',email_confirmed_at=now() WHERE id=%s",(self.user,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_set_engagement_email(%s,true)',(org,))
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT clinicx_prepare_notification_delivery(100)')
        self.c.execute('SELECT clinicx_claim_notification_delivery(50)')
        job=self.c.fetchone()[0][0]
        self.c.execute("UPDATE clinicx_notification_delivery SET first_attempt_at=now()-interval '24 hours',leased_until=now()-interval '1 second' WHERE id=%s",(job['id'],))
        self.c.execute('SELECT clinicx_claim_notification_delivery(50)')
        self.assertEqual(self.c.fetchone()[0],[])
        self.c.execute('SELECT needs_review,completed_at IS NULL,last_error FROM clinicx_notification_delivery WHERE id=%s',(job['id'],))
        self.assertEqual(self.c.fetchone(),(True,True,'retry_window_exhausted'))

    test_grace_and_expiry_preserve_clinical_data = foundation.SubscriptionDB.test_core_clinical_writes_then_grace_denies_writes_but_retains_reads
    test_export_retained_after_grace = foundation.SubscriptionDB.test_snapshot_usage_is_real_and_export_remains_authorized_after_grace
    test_recommendations_stay_usage_based_and_multidoctor_valid = foundation.SubscriptionDB.test_plan_catalog_limits_features_and_advisory_recommendations

    def test_no_consent_produces_inbox_only_and_never_sends_patient_data(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT clinicx_prepare_notification_delivery(50)')
        self.c.execute('SELECT clinicx_claim_notification_delivery(50)')
        self.assertEqual(self.c.fetchone()[0],[])
        self.c.execute('SELECT organization_id,user_id,category,meta FROM notifications WHERE organization_id=%s',(org,))
        row=self.c.fetchone()
        self.assertEqual(row[:3],(org,self.user,'billing'))
        self.assertNotIn('patient',str(row[3]))

if __name__ == '__main__': unittest.main(verbosity=2)
