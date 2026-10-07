"""Local selected-schema PG17 payment authority regressions; no remote/env DSN."""
import unittest
import uuid
import json
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('subscription_fixture',Path(__file__).with_name('test-clinicx-subscription-db.py'))
fixture=importlib.util.module_from_spec(spec); spec.loader.exec_module(fixture)
SubscriptionDB=fixture.SubscriptionDB
import psycopg2

class PaymentsDB(unittest.TestCase):
    stop_cluster = classmethod(SubscriptionDB.stop_cluster.__func__)
    @classmethod
    def setUpClass(cls):
        SubscriptionDB.setUpClass.__func__(cls)
        cls.c.execute("""CREATE TABLE public.transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),doctor_id uuid,razorpay_payment_id text,razorpay_order_id text,amount integer,currency text DEFAULT 'INR',plan text,billing_cycle text,status text,refund_id text,refund_amount integer,created_at timestamptz DEFAULT now());
          ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
          GRANT SELECT ON transactions TO authenticated; GRANT ALL ON transactions TO service_role;
          CREATE TABLE webhook_events(id text PRIMARY KEY,provider text NOT NULL DEFAULT 'razorpay',event_type text,payload jsonb,received_at timestamptz NOT NULL DEFAULT now());
          ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY; GRANT ALL ON webhook_events TO service_role;
          ALTER TABLE subscriptions ADD COLUMN gateway text,ADD COLUMN gateway_subscription_id text,ADD COLUMN gateway_customer_id text;
          ALTER TABLE transactions ADD COLUMN gateway text,ADD COLUMN gateway_payment_id text,ADD COLUMN gateway_order_id text;""")
        from pathlib import Path
        cls.c.execute(next((Path(__file__).resolve().parents[1]/'supabase/migrations').glob('20260705100450_*.sql')).read_text())
        migrations=sorted((Path(__file__).resolve().parents[1]/'supabase/migrations').glob('2026100714*.sql'))
        # Specialized workstream suites own their later migration loops; avoid replaying non-idempotent DDL twice.
        if cls is PaymentsDB:
            migrations+=sorted((Path(__file__).resolve().parents[1]/'supabase/migrations').glob('2026100717*.sql'))
        for p in migrations:
            cls.c.execute('BEGIN'); cls.c.execute(p.read_text()); cls.c.execute('COMMIT')
    def setUp(self):
        SubscriptionDB.setUp(self)
    provision = SubscriptionDB.provision
    denied = SubscriptionDB.denied
    def configure(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE plans SET monthly_price=2999,yearly_price=29990 WHERE id='growth'")
        self.c.execute("INSERT INTO clinicx_provider_prices(plan_id,billing_cycle,provider_plan_id,amount_paise,reviewed_at) VALUES('growth','monthly','plan_Growth',299900,now()) ON CONFLICT(plan_id,billing_cycle) DO NOTHING")
        self.c.execute('SET ROLE authenticated')
        return org
    def reserve(self,org):
        self.c.execute("SELECT clinicx_begin_checkout(%s,'growth','monthly')",(org,)); return self.c.fetchone()[0]
    def bind(self,attempt):
        self.c.execute('SET ROLE service_role')
        sid='sub_'+uuid.uuid4().hex
        self.c.execute('SELECT clinicx_bind_checkout(%s,%s,%s)',(attempt['id'],self.user,sid))
        return sid
    def evidence(self,sid,pid=None):
        self.c.execute('SELECT extract(epoch from now())::bigint'); start=self.c.fetchone()[0]
        return dict(payment_id=pid or 'pay_'+uuid.uuid4().hex,subscription_id=sid,provider_plan_id='plan_Growth',invoice_id='inv_'+uuid.uuid4().hex,amount_paise=299900,currency='INR',status='captured',period_start=start,period_end=start+2592000)
    def settle(self,e,event=None):
        self.c.execute('SELECT clinicx_settle_payment(%s,%s)',(event or 'evt_'+uuid.uuid4().hex,json.dumps(e))); return self.c.fetchone()[0]
    def test_actor_context_bound_to_org_and_no_client_settlement_authority(self):
        self.c.execute("SELECT to_regprocedure('clinicx_checkout_context(text,uuid,uuid)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'caller-owned checkout lookup missing')
        org=self.configure(); attempt=self.reserve(org); sid=self.bind(attempt)
        with self.assertRaises(psycopg2.Error,msg='null provider ID must not erase a trusted checkout binding'):
            self.c.execute('SELECT clinicx_bind_checkout(%s,%s,NULL)',(attempt['id'],self.user))
        self.c.execute('SET ROLE authenticated')
        self.c.execute("SELECT clinicx_checkout_context(%s,%s,%s)",(sid,org,attempt['id']))
        self.assertEqual(self.c.fetchone()[0]['organization_id'],org)
        self.denied("SELECT clinicx_checkout_context(%s,%s,NULL)",(sid,str(uuid.uuid4())))
        self.denied("SELECT clinicx_settle_payment('evt_attack','{}')")
        self.denied("UPDATE transactions SET amount=1")
        self.c.execute('RESET ROLE'); other=str(uuid.uuid4());self.c.execute('INSERT INTO auth.users(id) VALUES(%s)',(other,));self.c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(other,));self.c.execute('SET ROLE authenticated')
        self.denied("SELECT clinicx_checkout_context(%s,NULL,NULL)",(sid,))

    def test_failure_recovery_renewal_and_cancellation_preserve_paid_through(self):
        self.c.execute("SELECT to_regprocedure('clinicx_billing_lifecycle(text,text,text,bigint,uuid)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'atomic lifecycle authority missing')
        org=self.configure();a=self.reserve(org);sid=self.bind(a);e=self.evidence(sid);self.settle(e)
        self.c.execute("SELECT clinicx_billing_lifecycle('evt_stale_same_cycle',%s,'pending',%s,NULL)",(sid,e['period_start']))
        self.c.execute('SELECT status FROM subscriptions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],'active','failed retry of an already captured cycle cannot undo payment')
        self.c.execute("SELECT clinicx_billing_lifecycle('evt_failed',%s,'pending',%s,NULL)",(sid,e['period_end']))
        self.c.execute('SELECT status,recovery_ends_at IS NOT NULL,current_period_end=to_timestamp(%s) FROM subscriptions WHERE organization_id=%s',(e['period_end'],org));self.assertEqual(self.c.fetchone(),('past_due',True,True))
        self.c.execute("SELECT clinicx_billing_lifecycle('evt_failed',%s,'pending',%s,NULL)",(sid,e['period_end']))
        self.c.execute("SELECT clinicx_billing_lifecycle('evt_cancel',%s,'cancel_scheduled',NULL,%s)",(sid,self.user))
        self.c.execute('SELECT cancel_at_period_end,current_period_end=to_timestamp(%s) FROM subscriptions WHERE organization_id=%s',(e['period_end'],org));self.assertEqual(self.c.fetchone(),(True,True))
        renewal=self.evidence(sid);renewal['period_start']=e['period_start']+1;renewal['period_end']=e['period_end']+1
        self.settle(renewal)
        self.c.execute('SELECT status,cancel_at_period_end,recovery_ends_at FROM subscriptions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone(),('active',True,None))
        self.c.execute("SELECT clinicx_billing_lifecycle('evt_oldfailure',%s,'halted',%s,NULL)",(sid,e['period_start']))
        self.c.execute('SELECT status FROM subscriptions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],'active','stale failure cannot undo newer paid renewal')
        self.c.execute('SELECT count(*) FROM transactions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],2)

    def test_downgrade_reports_real_overlimit_counts_and_preserves_records(self):
        self.c.execute("SELECT to_regprocedure('clinicx_downgrade_check(uuid,text)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'downgrade usage authority missing')
        org=self.configure();self.c.execute('RESET ROLE')
        for _ in range(2):
            user=str(uuid.uuid4());self.c.execute('INSERT INTO auth.users(id) VALUES(%s)',(user,));self.c.execute("INSERT INTO organization_members(organization_id,user_id,role) VALUES(%s,%s,'staff')",(org,user))
        self.c.execute('SET ROLE authenticated');self.c.execute("SELECT clinicx_downgrade_check(%s,'starter')",(org,));report=self.c.fetchone()[0]
        self.assertFalse(report['allowed']);self.assertIn({'limit':'staff','used':2,'maximum':1},report['violations'])
        self.c.execute("SELECT count(*) FROM organization_members WHERE organization_id=%s AND role='staff'",(org,));self.assertEqual(self.c.fetchone()[0],2)

    def test_malformed_evidence_and_effect_failure_roll_back_receipt_and_ledger(self):
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid)
        missing=dict(e);missing.pop('status')
        with self.assertRaises(psycopg2.Error, msg='missing capture status must fail closed'):
            self.settle(missing,'evt_missing')
        self.c.execute("SELECT count(*) FROM webhook_events WHERE id='evt_missing'");self.assertEqual(self.c.fetchone()[0],0)
        self.c.execute('RESET ROLE')
        self.c.execute("CREATE FUNCTION fixture_fail_invoice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture injected invoice failure'; END $$; CREATE TRIGGER fixture_fail BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION fixture_fail_invoice()")
        self.c.execute('SET ROLE service_role')
        try:
            with self.assertRaises(psycopg2.Error):self.settle(e,'evt_recover')
            self.c.execute("SELECT count(*) FROM webhook_events WHERE id='evt_recover'");self.assertEqual(self.c.fetchone()[0],0)
            self.c.execute('SELECT count(*) FROM transactions WHERE gateway_payment_id=%s',(e['payment_id'],));self.assertEqual(self.c.fetchone()[0],0)
        finally:
            self.c.execute('RESET ROLE');self.c.execute('DROP TRIGGER fixture_fail ON invoices; DROP FUNCTION fixture_fail_invoice()');self.c.execute('SET ROLE service_role')
        self.assertTrue(self.settle(e,'evt_recover')['success'])

    def test_durable_signed_event_retries_until_atomic_completed_receipt(self):
        self.c.execute("SELECT to_regprocedure('clinicx_enqueue_billing_event(text,jsonb)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'durable reconciliation inbox missing')
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid)
        payload=json.dumps({'event':'subscription.charged','payload':{'subscription':{'entity':{'id':sid}},'payment':{'entity':{'id':e['payment_id']}}}})
        self.c.execute('SELECT clinicx_enqueue_billing_event(%s,%s)',('evt_job',payload));self.assertFalse(self.c.fetchone()[0]['completed'])
        self.c.execute('SELECT clinicx_claim_billing_events(10)');jobs=self.c.fetchone()[0];self.assertEqual(len(jobs),1)
        self.c.execute('SELECT clinicx_claim_billing_events(10)');self.assertEqual(self.c.fetchone()[0],[],'leases prevent parallel duplicate work')
        self.settle(e,'evt_job')
        self.c.execute("SELECT completed_at IS NOT NULL FROM clinicx_billing_jobs WHERE event_id='evt_job'");self.assertTrue(self.c.fetchone()[0])
        self.c.execute('SELECT clinicx_enqueue_billing_event(%s,%s)',('evt_job',payload));self.assertTrue(self.c.fetchone()[0]['completed'])
        with self.assertRaises(psycopg2.Error):self.c.execute("SELECT clinicx_enqueue_billing_event('evt_job','{}')")

    def test_failure_reminders_are_authorized_and_collapse_same_cycle_notifications(self):
        self.c.execute("SELECT to_regprocedure('clinicx_billing_reminders(uuid)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'authorized durable billing reminders missing')
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e)
        for event,status in [('evt_rem1','pending'),('evt_rem2','halted')]:
            self.c.execute('SELECT clinicx_billing_lifecycle(%s,%s,%s,%s,NULL)',(event,sid,status,e['period_end']))
        self.c.execute('SET ROLE authenticated');self.c.execute('SELECT clinicx_billing_reminders(%s)',(org,));rows=self.c.fetchone()[0]
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['kind'],'payment_failed')
        self.denied('SELECT clinicx_dismiss_billing_reminder(%s,%s)',(str(uuid.uuid4()),rows[0]['id']))
        self.c.execute('SELECT clinicx_dismiss_billing_reminder(%s,%s)',(org,rows[0]['id']))
        self.c.execute('SELECT clinicx_billing_reminders(%s)',(org,));self.assertEqual(self.c.fetchone()[0],[])
        self.denied("UPDATE subscription_reminders SET organization_id=%s",(str(uuid.uuid4()),))

    def test_real_handler_adapter_mock_transport_to_pg_atomic_end_to_end(self):
        from pathlib import Path
        script=Path(__file__).with_name('test-clinicx-payments-integration.cjs')
        self.assertTrue(script.exists(),'real caller/webhook to local SQL integration harness missing')
        import http.server, threading, subprocess, os
        from psycopg2 import sql
        org=self.configure()
        allowed={'clinicx_begin_checkout','clinicx_bind_checkout','clinicx_checkout_context','clinicx_provider_context','clinicx_enqueue_billing_event','clinicx_settle_payment','clinicx_billing_current','clinicx_billing_history','clinicx_billing_lifecycle','clinicx_checkout_uncertain','clinicx_downgrade_check','clinicx_charge_quote','clinicx_known_provider_plan','clinicx_reserve_recurring','clinicx_finish_recurring','clinicx_recurring_command_state'}
        owner=self
        class RPC(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_POST(self):
                body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                name=body['name'];args=body['args'];role=body['role']
                if name not in allowed or role not in ('authenticated','service_role'):
                    self.send_error(403);return
                con=psycopg2.connect(host=str(owner.socket),port=55447,dbname='postgres',user=os.environ['USER'])
                try:
                    cur=con.cursor();cur.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(owner.user if role=='authenticated' else '',));cur.execute(sql.SQL('SET ROLE {}').format(sql.Identifier(role)))
                    values=[json.dumps(v) if isinstance(v,(dict,list)) else v for v in args.values()]
                    query=sql.SQL('SELECT public.{}({})').format(sql.Identifier(name),sql.SQL(',').join(sql.SQL('{} => %s').format(sql.Identifier(k)) for k in args))
                    cur.execute(query,values);data=cur.fetchone()[0];con.commit();result={'data':data,'error':None}
                except psycopg2.Error as e:
                    con.rollback();result={'data':None,'error':{'message':e.diag.message_primary,'code':e.pgcode}}
                finally:con.close()
                content=json.dumps(result).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(content)
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),RPC);thread=threading.Thread(target=server.serve_forever);thread.start()
        try:
            run=subprocess.run(['node',str(script),f'http://127.0.0.1:{server.server_address[1]}',org,self.user],text=True,capture_output=True,timeout=90,cwd=Path(__file__).resolve().parents[1])
            self.assertEqual(run.returncode,0,run.stdout+run.stderr);print(run.stdout.strip())
        finally:server.shutdown();server.server_close();thread.join()

    def test_preflight_reports_legacy_duplicates_and_never_rescales_or_rewrites_ids(self):
        self.c.execute("SELECT to_regprocedure('clinicx_payment_preflight()')")
        self.assertIsNotNone(self.c.fetchone()[0], 'payment inventory preflight missing')
        org=self.configure();self.c.execute('RESET ROLE');legacy_pay='pay_Legacy'+uuid.uuid4().hex
        for _ in range(2):self.c.execute("INSERT INTO transactions(amount,gateway,gateway_payment_id,status) VALUES(2999,'razorpay',%s,'captured')",(legacy_pay,))
        self.c.execute('SET ROLE service_role');self.c.execute('SELECT clinicx_payment_preflight()');report=self.c.fetchone()[0]
        self.assertTrue(report['requires_live_provider_reconciliation']);self.assertGreaterEqual(report['duplicate_legacy_payment_ids'],1)
        self.c.execute('SELECT amount,canonical_amount_paise FROM transactions WHERE gateway_payment_id=%s',(legacy_pay,));self.assertEqual(self.c.fetchall(),[(2999,None),(2999,None)])
        self.c.execute("SELECT provider_plan_id FROM clinicx_provider_prices WHERE plan_id='growth' AND billing_cycle='monthly'");self.assertEqual(self.c.fetchone()[0],'plan_Growth')
        sid=self.bind(self.reserve_as_actor(org));e=self.evidence(sid);e['payment_id']=legacy_pay
        with self.assertRaises(psycopg2.Error):self.settle(e)
        self.c.execute('INSERT INTO invoices(organization_id,amount,invoice_number,razorpay_invoice_id) VALUES(%s,2999,%s,%s)',(org,'HIST-'+e['invoice_id'],e['invoice_id']))
        e['payment_id']='pay_New'+uuid.uuid4().hex
        with self.assertRaises(psycopg2.Error,msg='legacy provider invoice cannot acquire a duplicate paid row'):
            self.settle(e)
    def reserve_as_actor(self,org):
        self.c.execute('SET ROLE authenticated');a=self.reserve(org);self.c.execute('SET ROLE service_role');return a

    def test_eight_plan_cycle_quotes_preserve_reviewed_annual_id_and_drift_blocks_checkout(self):
        for plan,monthly in [('starter',999),('growth',2999),('professional',8599),('enterprise',19999)]:
            for cycle in ('monthly','yearly'):
                SubscriptionDB.setUp(self);org=self.provision()['organization_id'];self.c.execute('RESET ROLE')
                yearly=30990 if plan=='growth' else monthly*10
                self.c.execute('UPDATE plans SET monthly_price=%s,yearly_price=%s WHERE id=%s',(monthly,yearly,plan))
                provider_id='plan_'+plan+cycle
                amount=(monthly if cycle=='monthly' else yearly)*100
                self.c.execute('INSERT INTO clinicx_provider_prices(plan_id,billing_cycle,provider_plan_id,amount_paise,reviewed_at) VALUES(%s,%s,%s,%s,now()) ON CONFLICT(plan_id,billing_cycle) DO UPDATE SET provider_plan_id=EXCLUDED.provider_plan_id,amount_paise=EXCLUDED.amount_paise',(plan,cycle,provider_id,amount))
                self.c.execute('SET ROLE authenticated');self.c.execute('SELECT clinicx_begin_checkout(%s,%s,%s)',(org,plan,cycle));quote=self.c.fetchone()[0]
                self.assertEqual(quote['amount_paise'],amount);self.assertEqual(quote['provider_plan_id'],provider_id)
                self.c.execute('RESET ROLE');self.c.execute('UPDATE plans SET monthly_price=1 WHERE id=%s',(plan,));self.c.execute('SET ROLE authenticated')
                with self.assertRaises(psycopg2.Error,msg='drifting old price must never reach provider checkout'):self.c.execute('SELECT clinicx_begin_checkout(%s,%s,%s)',(org,plan,cycle))
                self.c.execute('RESET ROLE');self.c.execute('UPDATE plans SET monthly_price=%s WHERE id=%s',(monthly,plan))
        # Restore shared growth fixture map without changing any reserved annual attempt/ID.
        self.c.execute("UPDATE clinicx_provider_prices SET provider_plan_id='plan_Growth',amount_paise=299900 WHERE plan_id='growth' AND billing_cycle='monthly'")

    def test_cancel_scheduled_never_authorizes_overlapping_mandate_replacement(self):
        org=self.configure();sid=self.bind(self.reserve(org));self.settle(self.evidence(sid));self.c.execute('SET ROLE authenticated')
        with self.assertRaises(psycopg2.Error,msg='starting another live mandate must not silently leave the old one renewing'):
            self.reserve(org)
        self.c.execute('SET ROLE service_role');self.c.execute("SELECT clinicx_billing_lifecycle('evt_replace_cancel',%s,'cancel_scheduled',NULL,%s)",(sid,self.user));self.c.execute('SET ROLE authenticated')
        with self.assertRaises(psycopg2.Error, msg='scheduled cancellation cannot authorize overlap'):
            self.reserve(org)
        self.c.execute('SELECT gateway_subscription_id,status FROM subscriptions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone(),(sid,'active'))

    def test_failed_initial_checkout_keeps_trial_and_shows_failure_without_financial_row(self):
        org=self.configure();sid=self.bind(self.reserve(org));self.c.execute('SELECT extract(epoch from now())::bigint');period=self.c.fetchone()[0]
        self.c.execute("SELECT clinicx_billing_lifecycle('evt_initial_failure',%s,'pending',%s,NULL)",(sid,period))
        self.c.execute('SET ROLE authenticated');self.c.execute('SELECT clinicx_billing_reminders(%s)',(org,));self.assertEqual(len(self.c.fetchone()[0]),1,'checkout failure must remain visible even when trial stays effective')
        self.c.execute('SELECT status,access_source FROM subscriptions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone(),('trialing','free_trial'))
        self.c.execute('SET ROLE service_role');self.c.execute('SELECT count(*) FROM transactions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],0)

    def test_replaced_and_old_period_payments_never_extend_newer_entitlements(self):
        org=self.configure();sid=self.bind(self.reserve(org));first=self.evidence(sid);self.settle(first)
        self.c.execute("SELECT clinicx_billing_lifecycle('evt_replace_old',%s,'cancelled',NULL,%s)",(sid,self.user))
        # Isolated fixture time travel only; canonical terminal evidence alone never releases paid-through access.
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE subscriptions SET current_period_end=now()-interval '1 second' WHERE organization_id=%s",(org,))
        self.c.execute('SET ROLE service_role')
        replacement=self.bind(self.reserve_as_actor(org));second=self.evidence(replacement);second['period_start']=first['period_start']+1;second['period_end']=first['period_end']+1;self.settle(second)
        late=self.evidence(sid);late['period_end']=second['period_end']+100;self.settle(late)
        self.c.execute('SELECT gateway_subscription_id,current_period_end=to_timestamp(%s) FROM subscriptions WHERE organization_id=%s',(second['period_end'],org));self.assertEqual(self.c.fetchone(),(replacement,True))
        older=self.evidence(replacement);older['period_start']=first['period_start']-100;older['period_end']=first['period_end']-100;self.settle(older)
        self.c.execute('SELECT current_period_end=to_timestamp(%s) FROM subscriptions WHERE organization_id=%s',(second['period_end'],org));self.assertTrue(self.c.fetchone()[0])
        self.c.execute('SELECT count(*) FROM transactions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],4,'every valid captured charge remains recorded once without overwriting newer entitlement')

    def test_paid_growth_doctor_quota_blocks_invite_acceptance_atomically(self):
        org=self.configure(); sid=self.bind(self.reserve(org)); self.settle(self.evidence(sid))
        self.c.execute('RESET ROLE')
        invitee=str(uuid.uuid4()); email=invitee+'@example.invalid'
        self.c.execute('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(%s,%s,now())',(invitee,email))
        self.c.execute('SET ROLE authenticated')
        self.c.execute("INSERT INTO organization_invites(organization_id,email,role) VALUES(%s,%s,'doctor') RETURNING id,token",(org,email))
        iid,token=self.c.fetchone()
        self.c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(invitee,))
        self.denied('SELECT accept_invite(%s)',(token,))
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT accepted_at FROM organization_invites WHERE id=%s',(iid,)); self.assertIsNone(self.c.fetchone()[0])
        self.c.execute('SELECT count(*) FROM organization_members WHERE organization_id=%s AND user_id=%s',(org,invitee)); self.assertEqual(self.c.fetchone()[0],0)
        self.c.execute('SELECT count(*) FROM doctors WHERE organization_id=%s AND is_active',(org,)); self.assertEqual(self.c.fetchone()[0],1)
        self.c.execute('SELECT access_source FROM subscriptions WHERE organization_id=%s',(org,)); self.assertEqual(self.c.fetchone()[0],'verified_payment')

    def test_canonical_terminal_plus_elapsed_allows_replacement_but_neither_alone_does(self):
        org=self.configure(); sid=self.bind(self.reserve(org)); evidence=self.evidence(sid); self.settle(evidence)
        self.c.execute('RESET ROLE'); self.c.execute("UPDATE subscriptions SET current_period_end=now()-interval '1 second' WHERE organization_id=%s",(org,))
        self.c.execute('SET ROLE authenticated')
        with self.assertRaises(psycopg2.Error): self.reserve(org)
        self.c.execute('RESET ROLE'); self.c.execute('UPDATE subscriptions SET current_period_end=to_timestamp(%s) WHERE organization_id=%s',(evidence['period_end'],org))
        self.c.execute('SET ROLE service_role'); self.c.execute("SELECT clinicx_billing_lifecycle(%s,%s,'cancelled',NULL,%s)",('evt_terminal_'+uuid.uuid4().hex,sid,self.user))
        self.c.execute('SET ROLE authenticated')
        with self.assertRaises(psycopg2.Error): self.reserve(org)
        self.c.execute('RESET ROLE'); self.c.execute("UPDATE subscriptions SET current_period_end=now()-interval '1 second' WHERE organization_id=%s",(org,))
        self.c.execute('SET ROLE authenticated'); self.assertEqual(self.reserve(org)['state'],'creating')

    def test_checkout_does_not_replace_trial_then_captured_settlement_is_atomic(self):
        self.c.execute("SELECT to_regprocedure('clinicx_begin_checkout(uuid,text,text)')")
        self.assertIsNotNone(self.c.fetchone()[0], 'server-owned separate checkout authority missing')
        org=self.configure(); attempt=self.reserve(org)
        self.c.execute('SELECT status,access_source FROM subscriptions WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchone(),('trialing','free_trial'))
        sid=self.bind(attempt); e=self.evidence(sid); self.settle(e,'evt_capture')
        self.c.execute('SELECT status,access_source,current_period_end=to_timestamp(%s) FROM subscriptions WHERE organization_id=%s',(e['period_end'],org))
        self.assertEqual(self.c.fetchone(),('active','verified_payment',True))
        self.c.execute('SELECT amount,canonical_amount_paise,organization_id::text FROM transactions WHERE gateway_payment_id=%s',(e['payment_id'],))
        self.assertEqual(self.c.fetchone(),(299900,299900,org))
        self.c.execute('SELECT count(*) FROM invoices WHERE canonical_payment_id=%s',(e['payment_id'],));self.assertEqual(self.c.fetchone()[0],1)
        self.assertTrue(self.settle(e,'evt_capture')['deduped'])
        self.assertTrue(self.settle(e,'evt_other')['deduped'])
        self.c.execute('SELECT count(*) FROM transactions WHERE gateway_payment_id=%s',(e['payment_id'],));self.assertEqual(self.c.fetchone()[0],1)

if __name__=='__main__':
    unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(PaymentsDB)).wasSuccessful() or exit(1)
