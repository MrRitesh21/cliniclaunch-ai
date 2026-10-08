"""Offline recurring recovery: native private PostgreSQL, no project env/DSN."""
import importlib.util,json,unittest,os,uuid
from pathlib import Path
import psycopg2
spec=importlib.util.spec_from_file_location('recurring_fixture',Path(__file__).with_name('test-clinicx-recurring-db.py'))
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
Base=fixture.RecurringDB
class RecoveryDB(Base):
    @classmethod
    def setUpClass(cls):
        Base.setUpClass.__func__(cls)
        for p in sorted((Path(__file__).resolve().parents[1]/'supabase/migrations').glob('2026100720*.sql')):
            cls.c.execute('BEGIN');cls.c.execute(p.read_text());cls.c.execute('COMMIT')
    def uncertain(self):
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid)
        # Two historical periods, the command boundary is already elapsed. No live clock/provider changes.
        e.update(period_start=e['period_start']-7200,period_end=e['period_start']-3600)
        self.settle(e);self.c.execute('RESET ROLE')
        # Reserve requires unexpired access, then fixture travels the command's frozen boundary only.
        self.c.execute("UPDATE subscriptions SET current_period_end=now()+interval '1 hour' WHERE organization_id=%s",(org,))
        self.c.execute("UPDATE plans SET monthly_price=8599,yearly_price=85990 WHERE id='professional'")
        self.c.execute("INSERT INTO clinicx_provider_prices VALUES('professional','monthly','plan_Pro',859900,now()) ON CONFLICT(plan_id,billing_cycle) DO NOTHING")
        self.c.execute('SET ROLE authenticated');self.c.execute("SELECT clinicx_reserve_recurring(%s,'change','professional','monthly',NULL)",(org,));c=self.c.fetchone()[0]
        self.c.execute('RESET ROLE');self.c.execute("UPDATE clinicx_recurring_commands SET paid_through=to_timestamp(%s),state='uncertain' WHERE id=%s",(e['period_end'],c['id']))
        self.c.execute('SET ROLE service_role');self.c.execute('SELECT to_jsonb(c) FROM clinicx_recurring_commands c WHERE id=%s',(c['id'],));c=self.c.fetchone()[0]
        new=self.evidence(sid);new.update(provider_plan_id='plan_Pro',amount_paise=859900,period_start=e['period_end'],period_end=e['period_end']+2592000)
        return org,sid,e,c,new
    def snapshot(self,c,e):
        return dict(command_id=c['id'],actor_id=c['actor_id'],organization_id=c['organization_id'],
            subscription=dict(id=c['provider_subscription_id'],plan_id=c['provider_plan_id'],status='active',quantity=1,has_scheduled_changes=False),
            payment=dict(id=e['payment_id'],invoice_id=e['invoice_id'],subscription_id=e['subscription_id'],amount=e['amount_paise'],currency='INR',status='captured',captured=True,amount_refunded=0),
            invoice=dict(id=e['invoice_id'],payment_id=e['payment_id'],subscription_id=e['subscription_id'],amount=e['amount_paise'],currency='INR',status='paid',billing_start=e['period_start'],billing_end=e['period_end']),
            plan=dict(id=c['provider_plan_id'],period=c['billing_cycle'],interval=1,item=dict(amount=c['amount_paise'],currency='INR')))
    def recover(self,c,e,snapshot=None):
        self.c.execute('SELECT clinicx_recover_and_settle(%s,%s,%s,%s)',('evt_recovery_'+e['payment_id'],c['id'],json.dumps(snapshot or self.snapshot(c,e)),json.dumps(e)))
        return self.c.fetchone()[0]
    def test_applied_uncertain_command_and_charge_commit_atomically(self):
        self.c.execute("SELECT to_regprocedure('clinicx_recover_and_settle(text,uuid,jsonb,jsonb)')")
        self.assertIsNotNone(self.c.fetchone()[0],'applied uncertain command requires implemented transactional canonical recovery')
        org,sid,old,c,e=self.uncertain();self.assertTrue(self.recover(c,e)['success'])
        self.c.execute('SELECT state,effective_at=to_timestamp(%s) FROM clinicx_recurring_commands WHERE id=%s',(e['period_start'],c['id']));self.assertEqual(self.c.fetchone(),('applied',True))
        self.c.execute('SELECT plan_id FROM subscriptions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],'professional')
        self.assertTrue(self.recover(c,e)['deduped'])
        late=self.evidence(sid);late.update(period_start=old['period_start'],period_end=old['period_end']);self.settle(late)
        self.c.execute('SELECT canonical_provider_plan_id FROM invoices WHERE canonical_payment_id=%s',(late['payment_id'],));self.assertEqual(self.c.fetchone()[0],'plan_Growth')
    def test_real_service_adapter_schedule_cancel_and_reads_through_isolated_pg(self):
        import http.server,threading,subprocess
        from psycopg2 import sql
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e);self.c.execute('RESET ROLE')
        self.c.execute("UPDATE plans SET monthly_price=8599,yearly_price=85990 WHERE id='professional'")
        self.c.execute("INSERT INTO clinicx_provider_prices VALUES('professional','monthly','plan_Pro',859900,now()) ON CONFLICT(plan_id,billing_cycle) DO NOTHING")
        allowed={'clinicx_reserve_recurring','clinicx_finish_recurring','clinicx_recurring_command_state','clinicx_recurring_command_context','clinicx_renewal_context','clinicx_billing_current','clinicx_known_provider_plan','clinicx_charge_quote','clinicx_capture_quote','clinicx_recovery_context','clinicx_recover_and_settle','clinicx_stage_recurring_review','clinicx_claim_recurring_recovery','clinicx_recurring_recovery_command','clinicx_recover_terminal_command','clinicx_checkout_context','clinicx_provider_context','clinicx_enqueue_billing_event','clinicx_claim_billing_events','clinicx_retry_billing_event','clinicx_settle_payment','clinicx_billing_lifecycle'}
        owner=self
        class RPC(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_POST(self):
                body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));name=body['name'];args=body['args'];role=body['role']
                if name not in allowed|{'fixture_travel','fixture_due'} or role not in ('authenticated','service_role','fixture'):self.send_error(403);return
                con=psycopg2.connect(host=str(owner.socket),port=55447,dbname='postgres',user=os.environ['USER'])
                try:
                    cur=con.cursor()
                    if role=='fixture':
                        if name=='fixture_travel':cur.execute("UPDATE clinicx_recurring_commands SET paid_through=to_timestamp(%s),created_at=now()-interval '2 minutes',recovery_after=now() WHERE id=%s AND organization_id=%s",(args['boundary'],args['command'],org))
                        elif name=='fixture_due':
                            cur.execute('UPDATE clinicx_billing_jobs SET available_at=now(),leased_until=NULL WHERE event_id=%s',('callback:pay_Recovery'+sid[4:],))
                            cur.execute('UPDATE clinicx_recurring_commands SET recovery_after=now() WHERE provider_subscription_id=%s',(sid,))
                        else:raise ValueError('Fixture op denied')
                        data=True
                    else:
                        cur.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(owner.user if role=='authenticated' else '',));cur.execute(sql.SQL('SET ROLE {}').format(sql.Identifier(role)))
                        values=[json.dumps(v) if isinstance(v,(dict,list)) else v for v in args.values()]
                        query=sql.SQL('SELECT public.{}({})').format(sql.Identifier(name),sql.SQL(',').join(sql.SQL('{} => %s').format(sql.Identifier(k)) for k in args))
                        cur.execute(query,values);data=cur.fetchone()[0]
                    con.commit();result={'data':data,'error':None}
                except psycopg2.Error as err:
                    con.rollback();result={'data':None,'error':{'message':err.diag.message_primary,'code':err.pgcode}}
                finally:con.close()
                content=json.dumps(result).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(content)
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),RPC);thread=threading.Thread(target=server.serve_forever);thread.start()
        try:
            script=Path(__file__).with_name('test-clinicx-billing-recovery-integration.cjs')
            env={k:os.environ[k] for k in ('PATH','HOME','USER','TMPDIR') if k in os.environ}
            run=subprocess.run(['node',str(script),f'http://127.0.0.1:{server.server_address[1]}',org,sid,str(e['period_end'])],env=env,text=True,capture_output=True,timeout=90,cwd=Path(__file__).resolve().parents[1])
            self.assertEqual(run.returncode,0,run.stdout+run.stderr);print(run.stdout.strip())
            self.c.execute('SELECT count(*) FROM transactions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],2)
            self.c.execute('SELECT count(*) FROM invoices WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],2)
            self.c.execute('SELECT state FROM clinicx_recurring_commands WHERE organization_id=%s ORDER BY created_at,id',(org,));self.assertEqual(self.c.fetchall(),[('applied',),('confirmed',)])
        finally:server.shutdown();server.server_close();thread.join()
    def test_equal_price_requires_distinct_admin_approved_invoice_quote(self):
        org,sid,old,c,e=self.uncertain();self.c.execute('RESET ROLE')
        self.c.execute('UPDATE clinicx_recurring_commands SET amount_paise=299900 WHERE id=%s',(c['id'],));c['amount_paise']=299900;e['amount_paise']=299900
        self.c.execute('SET ROLE service_role');snapshot=self.snapshot(c,e)
        with self.assertRaises(psycopg2.Error):self.recover(c,e,snapshot)
        self.c.execute("SELECT to_regprocedure('clinicx_stage_recurring_review(uuid,jsonb)')")
        self.assertIsNotNone(self.c.fetchone()[0],'equal-price recovery needs implemented controlled operator review')
        self.c.execute('SELECT clinicx_stage_recurring_review(%s,%s)',(c['id'],json.dumps(snapshot)));review=self.c.fetchone()[0];self.assertTrue(review['requires_review']);self.assertFalse(review['approved'])
        self.c.execute('SET ROLE authenticated');self.denied('SELECT clinicx_approve_recurring_review(%s,%s,%s,%s)',(review['review_id'],'plan_Pro','Confirmed from independent provider ledger','provider-case-42'))
        reviewer=str(uuid.uuid4());self.c.execute('RESET ROLE');self.c.execute('INSERT INTO auth.users(id) VALUES(%s)',(reviewer,))
        self.c.execute("CREATE OR REPLACE FUNCTION is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1=%s::uuid $$",(reviewer,))
        self.c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(reviewer,));self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_approve_recurring_review(%s,%s,%s,%s)',(review['review_id'],'plan_Growth','Old full-price boundary invoice verified independently','provider-case-42'));self.assertEqual(self.c.fetchone()[0]['state'],'approved')
        self.c.execute('SET ROLE service_role');selected=dict(e,provider_plan_id='plan_Growth');self.assertTrue(self.recover(c,selected,snapshot)['success'])
        self.c.execute('SELECT canonical_provider_plan_id FROM invoices WHERE canonical_payment_id=%s',(e['payment_id'],));self.assertEqual(self.c.fetchone()[0],'plan_Growth')
        self.assertTrue(self.recover(c,selected,snapshot)['deduped'])
        self.c.execute('RESET ROLE');self.c.execute('CREATE OR REPLACE FUNCTION is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$')
    def test_uncertain_cancel_closes_on_canonical_terminal_readback(self):
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e)
        self.c.execute('SET ROLE authenticated');self.c.execute("SELECT clinicx_reserve_recurring(%s,'cancel',NULL,NULL,'Practice closed')",(org,));c=self.c.fetchone()[0]
        self.c.execute('SET ROLE service_role');self.c.execute("SELECT clinicx_recurring_command_state(%s,%s,'uncertain')",(c['id'],self.user))
        self.c.execute("SELECT to_regprocedure('clinicx_recover_terminal_command(uuid,uuid,jsonb)')")
        self.assertIsNotNone(self.c.fetchone()[0],'terminal readback must close uncertain cancellation command')
        remote=dict(id=sid,plan_id='plan_Growth',status='completed')
        for _ in range(2):
            self.c.execute('SELECT clinicx_recover_terminal_command(%s,%s,%s)',(c['id'],self.user,json.dumps(remote)));self.assertEqual(self.c.fetchone()[0]['state'],'confirmed')
        self.c.execute('SELECT current_period_end=to_timestamp(%s),cancel_at_period_end FROM subscriptions WHERE organization_id=%s',(e['period_end'],org));self.assertEqual(self.c.fetchone(),(True,True))
        self.c.execute('SET ROLE authenticated');self.c.execute('SELECT clinicx_renewal_context(%s)',(org,));self.assertIsNone(self.c.fetchone()[0]['command_state'])
    def test_invalid_recovery_cannot_write_command_or_ledger(self):
        import copy
        org,sid,old,c,e=self.uncertain()
        for path,value in [('organization_id',str(uuid.uuid4())),('actor_id',str(uuid.uuid4())),('subscription.plan_id','plan_Attack'),('subscription.has_scheduled_changes',True),('invoice.payment_id','pay_Wrong'),('payment.amount',1),('plan.item.amount',1),('invoice.billing_start',old['period_start']),('payment.amount_refunded',1),('invoice.id',None),('payment.id',None)]:
            snap=copy.deepcopy(self.snapshot(c,e));target=snap;parts=path.split('.')
            for p in parts[:-1]:target=target[p]
            target[parts[-1]]=value
            with self.assertRaises(psycopg2.Error,msg=path):self.recover(c,e,snap)
        self.c.execute('SELECT state,effective_at FROM clinicx_recurring_commands WHERE id=%s',(c['id'],));self.assertEqual(self.c.fetchone(),('uncertain',None))
        self.c.execute('SELECT count(*) FROM transactions WHERE gateway_payment_id=%s',(e['payment_id'],));self.assertEqual(self.c.fetchone()[0],0)
    def test_settlement_failure_rolls_back_recovery_confirmation(self):
        org,sid,old,c,e=self.uncertain();self.c.execute('RESET ROLE')
        self.c.execute("CREATE FUNCTION fixture_recovery_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture injected'; END $$; CREATE TRIGGER fixture_recovery_fail BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION fixture_recovery_fail()")
        self.c.execute('SET ROLE service_role')
        try:
            with self.assertRaises(psycopg2.Error):self.recover(c,e)
            self.c.execute('SELECT state,effective_at FROM clinicx_recurring_commands WHERE id=%s',(c['id'],));self.assertEqual(self.c.fetchone(),('uncertain',None))
            self.c.execute("SELECT count(*) FROM subscription_events WHERE event_key=%s",('command-recovered:'+c['id'],));self.assertEqual(self.c.fetchone()[0],0)
        finally:
            self.c.execute('RESET ROLE');self.c.execute('DROP TRIGGER fixture_recovery_fail ON invoices; DROP FUNCTION fixture_recovery_fail()');self.c.execute('SET ROLE service_role')
        self.assertTrue(self.recover(c,e)['success'])
if __name__=='__main__':
    unittest.main(verbosity=2)
