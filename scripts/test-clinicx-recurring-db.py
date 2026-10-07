"""Isolated selected-schema PostgreSQL recurring lifecycle regressions; no project env/DSN."""
import importlib.util
import json
import unittest
from pathlib import Path
import psycopg2
spec=importlib.util.spec_from_file_location('payments_fixture',Path(__file__).with_name('test-clinicx-payments-db.py'))
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
Base=fixture.PaymentsDB
class RecurringDB(unittest.TestCase):
    stop_cluster=classmethod(Base.stop_cluster.__func__)
    @classmethod
    def setUpClass(cls):
        Base.setUpClass.__func__(cls)
        for p in sorted((Path(__file__).resolve().parents[1]/'supabase/migrations').glob('2026100717*.sql')):
            cls.c.execute('BEGIN');cls.c.execute(p.read_text());cls.c.execute('COMMIT')
    setUp=Base.setUp
    provision=Base.provision
    configure=Base.configure
    reserve=Base.reserve
    bind=Base.bind
    evidence=Base.evidence
    settle=Base.settle
    denied=Base.denied
    test_actor_context_bound_to_org_and_no_client_settlement_authority=Base.test_actor_context_bound_to_org_and_no_client_settlement_authority
    test_failure_recovery_renewal_and_cancellation_preserve_paid_through=Base.test_failure_recovery_renewal_and_cancellation_preserve_paid_through
    test_downgrade_reports_real_overlimit_counts_and_preserves_records=Base.test_downgrade_reports_real_overlimit_counts_and_preserves_records
    test_malformed_evidence_and_effect_failure_roll_back_receipt_and_ledger=Base.test_malformed_evidence_and_effect_failure_roll_back_receipt_and_ledger
    test_durable_signed_event_retries_until_atomic_completed_receipt=Base.test_durable_signed_event_retries_until_atomic_completed_receipt
    test_failure_reminders_are_authorized_and_collapse_same_cycle_notifications=Base.test_failure_reminders_are_authorized_and_collapse_same_cycle_notifications
    test_failed_initial_checkout_keeps_trial_and_shows_failure_without_financial_row=Base.test_failed_initial_checkout_keeps_trial_and_shows_failure_without_financial_row
    test_checkout_does_not_replace_trial_then_captured_settlement_is_atomic=Base.test_checkout_does_not_replace_trial_then_captured_settlement_is_atomic
    def test_scheduled_cancel_does_not_authorize_overlapping_replacement(self):
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e)
        self.c.execute("SELECT clinicx_billing_lifecycle('evt_recurring_scheduled_cancel',%s,'cancel_scheduled',NULL,%s)",(sid,self.user))
        self.c.execute('SET ROLE authenticated')
        with self.assertRaises(psycopg2.Error,msg='cancel flag cannot authorize a second mandate or overlapping paid period'):
            self.reserve(org)
        self.c.execute('SELECT gateway_subscription_id FROM subscriptions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],sid)
    def test_command_freezes_quote_actor_and_keeps_paid_access(self):
        self.c.execute("SELECT to_regprocedure('clinicx_reserve_recurring(uuid,text,text,text,text)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'audited recurring command reservation missing')
        org=self.configure();sid=self.bind(self.reserve(org));self.settle(self.evidence(sid));self.c.execute('RESET ROLE')
        self.c.execute("UPDATE plans SET monthly_price=8599,yearly_price=85990 WHERE id='professional'")
        self.c.execute("INSERT INTO clinicx_provider_prices VALUES('professional','monthly','plan_Pro',859900,now()) ON CONFLICT(plan_id,billing_cycle) DO NOTHING")
        self.c.execute('SET ROLE authenticated')
        self.c.execute("SELECT clinicx_reserve_recurring(%s,'change','professional','monthly',NULL)",(org,));command=self.c.fetchone()[0]
        self.assertEqual(command['actor_id'],self.user);self.assertEqual(command['amount_paise'],859900)
        with self.assertRaises(psycopg2.Error):
            self.c.execute("SELECT clinicx_reserve_recurring(%s,'change','professional','monthly',NULL)",(org,))
        self.c.execute('SELECT plan_id,status,current_period_end FROM subscriptions WHERE organization_id=%s',(org,));row=self.c.fetchone();self.assertEqual(row[:2],('growth','active'))
        self.denied("SELECT clinicx_reserve_recurring(%s,'cancel',NULL,NULL,NULL)",('00000000-0000-4000-8000-000000000099',))
        self.denied("UPDATE clinicx_recurring_commands SET amount_paise=1")

    def schedule(self):
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e)
        self.c.execute('RESET ROLE');self.c.execute("UPDATE plans SET monthly_price=8599,yearly_price=85990 WHERE id='professional'")
        self.c.execute("INSERT INTO clinicx_provider_prices VALUES('professional','monthly','plan_Pro',859900,now()) ON CONFLICT(plan_id,billing_cycle) DO NOTHING")
        self.c.execute('SET ROLE authenticated');self.c.execute("SELECT clinicx_reserve_recurring(%s,'change','professional','monthly',NULL)",(org,));c=self.c.fetchone()[0]
        self.c.execute('SET ROLE service_role');self.c.execute('SELECT clinicx_finish_recurring(%s,%s,%s)',(c['id'],self.user,json.dumps(dict(id=sid,plan_id='plan_Pro',status='active',has_scheduled_changes=True,change_scheduled_at=e['period_end'],quantity=1))))
        self.assertEqual(self.c.fetchone()[0]['state'],'scheduled')
        return org,sid,e,c
    def test_trusted_schedule_readback_freezes_period_and_not_effective_plan(self):
        self.c.execute("SELECT to_regprocedure('clinicx_finish_recurring(uuid,uuid,jsonb)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'trusted recurring readback commit missing')
        org,sid,e,c=self.schedule()
        self.c.execute('SELECT plan_id,current_period_end=to_timestamp(%s) FROM subscriptions WHERE organization_id=%s',(e['period_end'],org));self.assertEqual(self.c.fetchone(),('growth',True))
        self.c.execute('SELECT provider_plan_id,amount_paise FROM clinicx_checkout_attempts WHERE provider_subscription_id=%s',(sid,));self.assertEqual(self.c.fetchone(),('plan_Growth',299900),'checkout quote must remain immutable')
        with self.assertRaises(psycopg2.Error):self.c.execute('SELECT clinicx_finish_recurring(%s,%s,%s)',(c['id'],self.user,json.dumps(dict(id=sid,plan_id='plan_Attack',status='active',has_scheduled_changes=True,change_scheduled_at=e['period_end'],quantity=1))))
        self.c.execute('SET ROLE authenticated');self.denied('SELECT clinicx_finish_recurring(%s,%s,%s)',(c['id'],self.user,'{}'))

    def test_scheduled_renewal_settles_frozen_quote_and_old_charge_keeps_own_period(self):
        org,sid,e,c=self.schedule()
        new=self.evidence(sid);new.update(provider_plan_id='plan_Pro',amount_paise=859900,period_start=e['period_end'],period_end=e['period_end']+2592000)
        # Fixture travels only the captured invoice time; no provider or real clock is changed.
        self.c.execute('RESET ROLE');self.c.execute("UPDATE clinicx_recurring_commands SET effective_at=now()-interval '1 hour' WHERE id=%s",(c['id'],))
        new['period_start']=e['period_start'];new['period_end']=e['period_end']+1
        self.c.execute('SET ROLE service_role')
        self.assertTrue(self.settle(new)['success'])
        self.c.execute('SELECT plan_id,current_period_end=to_timestamp(%s) FROM subscriptions WHERE organization_id=%s',(new['period_end'],org));self.assertEqual(self.c.fetchone(),('professional',True))
        self.c.execute('SELECT state FROM clinicx_recurring_commands WHERE id=%s',(c['id'],));self.assertEqual(self.c.fetchone()[0],'applied')
        self.c.execute("SELECT details->>'command_id' FROM subscription_events WHERE organization_id=%s AND event_key=%s",(org,'payment:'+new['payment_id']));self.assertEqual(self.c.fetchone()[0],c['id'])
        old=self.evidence(sid);old.update(period_start=e['period_start']-7200,period_end=e['period_end']-7200)
        self.assertTrue(self.settle(old)['success'])
        self.c.execute('SELECT plan_id,current_period_end=to_timestamp(%s) FROM subscriptions WHERE organization_id=%s',(new['period_end'],org));self.assertEqual(self.c.fetchone(),('professional',True))
        self.c.execute('SELECT canonical_period_start=to_timestamp(%s),canonical_period_end=to_timestamp(%s),canonical_provider_plan_id FROM invoices WHERE canonical_payment_id=%s',(old['period_start'],old['period_end'],old['payment_id']));self.assertEqual(self.c.fetchone(),(True,True,'plan_Growth'))
        conflict=dict(new,period_end=new['period_end']+1)
        with self.assertRaises(psycopg2.Error,msg='duplicate payment cannot claim a different invoice period'):self.settle(conflict)

    def test_cancellation_reason_keeps_paid_through_and_requires_terminal_before_new_mandate(self):
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e);self.c.execute('SET ROLE authenticated')
        self.c.execute("SELECT clinicx_reserve_recurring(%s,'cancel',NULL,NULL,'Moving practice')",(org,));c=self.c.fetchone()[0]
        self.c.execute('SET ROLE service_role')
        with self.assertRaises(psycopg2.Error):self.c.execute('SELECT clinicx_finish_recurring(%s,%s,%s)',(c['id'],self.user,json.dumps(dict(id=sid,plan_id='plan_Growth',status='active',has_scheduled_changes=True))))
        self.c.execute('SELECT clinicx_finish_recurring(%s,%s,%s)',(c['id'],self.user,json.dumps(dict(id=sid,plan_id='plan_Growth',status='cancelled'))));self.assertEqual(self.c.fetchone()[0]['reason'],'Moving practice')
        self.c.execute('SET ROLE authenticated');self.c.execute('SELECT clinicx_billing_current(%s)',(org,));self.assertTrue(self.c.fetchone()[0]['active'])
        with self.assertRaises(psycopg2.Error):self.reserve(org)
        self.c.execute('RESET ROLE');self.c.execute("UPDATE subscriptions SET current_period_end=now()-interval '1 second' WHERE organization_id=%s",(org,));self.c.execute('SET ROLE authenticated')
        self.assertEqual(self.reserve(org)['state'],'creating')
    def test_future_downgrade_admission_stops_usage_drift_without_deleting_data(self):
        org=self.configure();sid=self.bind(self.reserve(org));self.settle(self.evidence(sid));self.c.execute('RESET ROLE')
        self.c.execute("UPDATE plans SET monthly_price=999,yearly_price=9990 WHERE id='starter'")
        self.c.execute("INSERT INTO clinicx_provider_prices VALUES('starter','monthly','plan_Starter',99900,now()) ON CONFLICT(plan_id,billing_cycle) DO NOTHING")
        self.c.execute('SET ROLE authenticated');self.c.execute("SELECT clinicx_reserve_recurring(%s,'change','starter','monthly',NULL)",(org,));c=self.c.fetchone()[0]
        self.c.execute('RESET ROLE')
        import uuid
        users=[str(uuid.uuid4()) for _ in range(2)]
        for u in users:self.c.execute('INSERT INTO auth.users(id) VALUES(%s)',(u,))
        self.c.execute("INSERT INTO organization_members(organization_id,user_id,role) VALUES(%s,%s,'staff')",(org,users[0]))
        with self.assertRaises(psycopg2.Error,msg='scheduled target quota must block growth before renewal charges'):
            self.c.execute("INSERT INTO organization_members(organization_id,user_id,role) VALUES(%s,%s,'staff')",(org,users[1]))
        self.c.execute('SELECT count(*) FROM organization_members WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],2,'owner and existing staff retained')

    def test_billing_read_contracts_are_tenant_scoped_with_stable_tied_timestamp_pages(self):
        self.c.execute("SELECT to_regprocedure('clinicx_renewal_context(uuid)'),to_regprocedure('clinicx_billing_history_page(uuid,text,timestamptz,uuid,integer)'),to_regprocedure('clinicx_invoice_detail(uuid,uuid)')")
        self.assertNotIn(None,self.c.fetchone(),'authoritative billing read contracts missing')
        org=self.configure();sid=self.bind(self.reserve(org))
        for _ in range(3):self.settle(self.evidence(sid))
        self.c.execute('RESET ROLE');self.c.execute("UPDATE transactions SET created_at='2026-10-01T00:00:00Z' WHERE organization_id=%s",(org,));self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_renewal_context(%s)',(org,));renewal=self.c.fetchone()[0];self.assertEqual(renewal['amount_paise'],299900)
        found=[];cursor=None
        for _ in range(3):
            self.c.execute("SELECT clinicx_billing_history_page(%s,'payments',%s,%s,1)",(org,cursor['created_at'] if cursor else None,cursor['id'] if cursor else None));page=self.c.fetchone()[0]
            found.extend(row['id'] for row in page['entries']);cursor=page['next_cursor']
        self.assertEqual(len(set(found)),3);self.assertIsNone(cursor)
        self.c.execute("SELECT clinicx_billing_history_page(%s,'invoices',NULL,NULL,1)",(org,));inv=self.c.fetchone()[0]['entries'][0]
        self.c.execute('SELECT clinicx_invoice_detail(%s,%s)',(org,inv['id']));detail=self.c.fetchone()[0];self.assertEqual(detail['amount_paise'],299900);self.assertIsNotNone(detail['period_start'])
        self.denied('SELECT clinicx_invoice_detail(%s,%s)',('00000000-0000-4000-8000-000000000099',inv['id']))
        with self.assertRaises(psycopg2.Error):self.c.execute("SELECT clinicx_billing_history_page(%s,'payments',NULL,NULL,NULL)",(org,))
        with self.assertRaises(psycopg2.Error):self.c.execute("SELECT clinicx_billing_history_page(%s,'payments',now(),NULL,1)",(org,))

    def test_canonical_terminal_lifecycle_releases_only_elapsed_replacement(self):
        org=self.configure();sid=self.bind(self.reserve(org));self.settle(self.evidence(sid))
        self.c.execute("SELECT clinicx_billing_lifecycle('evt_terminal',%s,'cancelled',NULL,NULL)",(sid,))
        self.c.execute('RESET ROLE');self.c.execute("UPDATE subscriptions SET current_period_end=now()-interval '1 second' WHERE organization_id=%s",(org,));self.c.execute('SET ROLE authenticated')
        self.assertEqual(self.reserve(org)['state'],'creating')
    def test_cancel_can_stop_a_scheduled_change_without_removing_paid_access(self):
        org,sid,e,change=self.schedule();self.c.execute('SET ROLE authenticated')
        self.c.execute("SELECT clinicx_reserve_recurring(%s,'cancel',NULL,NULL,NULL)",(org,));c=self.c.fetchone()[0]
        self.c.execute('SET ROLE service_role');self.c.execute('SELECT clinicx_finish_recurring(%s,%s,%s)',(c['id'],self.user,json.dumps(dict(id=sid,plan_id='plan_Growth',status='cancelled'))))
        self.c.execute('SELECT state FROM clinicx_recurring_commands WHERE id=%s',(change['id'],));self.assertEqual(self.c.fetchone()[0],'superseded')
        self.c.execute('SELECT current_period_end=to_timestamp(%s) FROM subscriptions WHERE organization_id=%s',(e['period_end'],org));self.assertTrue(self.c.fetchone()[0])

    def test_real_service_adapter_schedule_cancel_and_reads_through_isolated_pg(self):
        import http.server,threading,subprocess,os
        from psycopg2 import sql
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e)
        self.c.execute('RESET ROLE');self.c.execute("UPDATE plans SET monthly_price=8599,yearly_price=85990 WHERE id='professional'")
        self.c.execute("INSERT INTO clinicx_provider_prices VALUES('professional','yearly','plan_ProAnnual',8599000,now()) ON CONFLICT(plan_id,billing_cycle) DO NOTHING")
        self.c.execute('SELECT id::text FROM invoices WHERE canonical_payment_id=%s',(e['payment_id'],));invoice=self.c.fetchone()[0]
        allowed={'clinicx_reserve_recurring','clinicx_finish_recurring','clinicx_recurring_command_state','clinicx_recurring_command_context','clinicx_renewal_context','clinicx_invoice_detail','clinicx_billing_history_page','clinicx_billing_current','clinicx_begin_checkout','clinicx_known_provider_plan'}
        owner=self
        class RPC(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_POST(self):
                body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));name=body['name'];args=body['args'];role=body['role']
                if name not in allowed or role not in ('authenticated','service_role'):self.send_error(403);return
                con=psycopg2.connect(host=str(owner.socket),port=55447,dbname='postgres',user=os.environ['USER'])
                try:
                    cur=con.cursor();cur.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(owner.user if role=='authenticated' else '',));cur.execute(sql.SQL('SET ROLE {}').format(sql.Identifier(role)))
                    values=[json.dumps(v) if isinstance(v,(dict,list)) else v for v in args.values()]
                    query=sql.SQL('SELECT public.{}({})').format(sql.Identifier(name),sql.SQL(',').join(sql.SQL('{} => %s').format(sql.Identifier(k)) for k in args))
                    cur.execute(query,values);data=cur.fetchone()[0];con.commit();result={'data':data,'error':None}
                except psycopg2.Error as err:
                    con.rollback();result={'data':None,'error':{'message':err.diag.message_primary,'code':err.pgcode}}
                finally:con.close()
                content=json.dumps(result).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(content)
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),RPC);thread=threading.Thread(target=server.serve_forever);thread.start()
        try:
            script=Path(__file__).with_name('test-clinicx-recurring-integration.cjs')
            run=subprocess.run(['node',str(script),f'http://127.0.0.1:{server.server_address[1]}',org,sid,str(e['period_end']),invoice],text=True,capture_output=True,timeout=45,cwd=Path(__file__).resolve().parents[1])
            self.assertEqual(run.returncode,0,run.stdout+run.stderr);print(run.stdout.strip())
            self.c.execute('SELECT current_period_end=to_timestamp(%s),cancel_at_period_end FROM subscriptions WHERE organization_id=%s',(e['period_end'],org));self.assertEqual(self.c.fetchone(),(True,True))
            self.c.execute('SELECT state FROM clinicx_recurring_commands WHERE organization_id=%s ORDER BY created_at',(org,));self.assertEqual(self.c.fetchall(),[('superseded',),('confirmed',),('aborted',)])
        finally:server.shutdown();server.server_close();thread.join()

    def test_boundary_quote_rejects_proration_null_or_equal_price_ambiguity(self):
        org,sid,e,c=self.schedule()
        for amount,expected in [(299900,'plan_Growth'),(859900,'plan_Pro')]:
            self.c.execute('SELECT clinicx_charge_quote(%s,%s,%s)',(sid,e['period_end'],amount));self.assertEqual(self.c.fetchone()[0]['provider_plan_id'],expected)
        for amount in [None,1,50000]:
            with self.assertRaises(psycopg2.Error):self.c.execute('SELECT clinicx_charge_quote(%s,%s,%s)',(sid,e['period_end'],amount))
        self.c.execute('RESET ROLE');self.c.execute('UPDATE clinicx_recurring_commands SET amount_paise=299900 WHERE id=%s',(c['id'],));self.c.execute('SET ROLE service_role')
        with self.assertRaises(psycopg2.Error,msg='equal-price boundary cannot infer which cycle or plan invoice paid'):
            self.c.execute('SELECT clinicx_charge_quote(%s,%s,299900)',(sid,e['period_end']))

    def test_concurrent_actor_reservations_allow_only_one_provider_command(self):
        import os
        from concurrent.futures import ThreadPoolExecutor
        org=self.configure();sid=self.bind(self.reserve(org));self.settle(self.evidence(sid))
        def reserve_cancel(_):
            con=psycopg2.connect(host=str(self.socket),port=55447,dbname='postgres',user=os.environ['USER'])
            try:
                cur=con.cursor();cur.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(self.user,));cur.execute('SET ROLE authenticated')
                cur.execute("SELECT clinicx_reserve_recurring(%s,'cancel',NULL,NULL,NULL)",(org,));data=cur.fetchone()[0];con.commit();return data['id']
            except psycopg2.Error:
                con.rollback();return None
            finally:con.close()
        with ThreadPoolExecutor(2) as pool:results=list(pool.map(reserve_cancel,[0,1]))
        self.assertEqual(sum(x is not None for x in results),1,'only one durable command may reach provider')
        self.c.execute('SELECT count(*) FROM clinicx_recurring_commands WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],1)

    def test_existing_overquota_downgrade_cannot_reserve_or_delete_data(self):
        import uuid
        org=self.configure();sid=self.bind(self.reserve(org));self.settle(self.evidence(sid));self.c.execute('RESET ROLE')
        self.c.execute("UPDATE plans SET monthly_price=999,yearly_price=9990 WHERE id='starter'")
        self.c.execute("INSERT INTO clinicx_provider_prices VALUES('starter','monthly','plan_Starter',99900,now()) ON CONFLICT(plan_id,billing_cycle) DO NOTHING")
        for _ in range(2):
            u=str(uuid.uuid4());self.c.execute('INSERT INTO auth.users(id) VALUES(%s)',(u,));self.c.execute("INSERT INTO organization_members(organization_id,user_id,role) VALUES(%s,%s,'staff')",(org,u))
        self.c.execute('SET ROLE authenticated')
        with self.assertRaisesRegex(psycopg2.Error,'Target plan over capacity'):
            self.c.execute("SELECT clinicx_reserve_recurring(%s,'change','starter','monthly',NULL)",(org,))
        self.c.execute('SET ROLE service_role');self.c.execute('SELECT count(*) FROM clinicx_recurring_commands WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],0)
        self.c.execute('SELECT count(*) FROM organization_members WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],3)

if __name__=='__main__':
    unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(RecurringDB)).wasSuccessful() or exit(1)
