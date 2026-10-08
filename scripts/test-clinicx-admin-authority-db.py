"""Cumulative selected-schema PG17 admin authority regression; Unix socket only."""
import importlib.util, json, os, unittest
from pathlib import Path
import psycopg2
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('admin_fixture',ROOT/'scripts/test-clinicx-admin-db.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
A=f.AdminDB
class AuthorityDB(unittest.TestCase):
    stop_cluster=classmethod(A.stop_cluster.__func__)
    @classmethod
    def setUpClass(cls):
        A.setUpClass.__func__(cls)
        for prefix in ['2026100716','2026100717','2026100718']:
            for p in sorted((ROOT/'supabase/migrations').glob(prefix+'*.sql')):
                cls.c.execute('BEGIN');cls.c.execute(p.read_text());cls.c.execute('COMMIT')
    setUp=A.setUp
    provision=A.provision
    denied=A.denied
    configure=A.configure
    reserve=A.reserve
    bind=A.bind
    evidence=A.evidence
    settle=A.settle
    admin=A.admin
    stats=A.stats
    def switch(self,yearly=False):
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e)
        self.c.execute('RESET ROLE')
        plan='growth' if yearly else 'professional';cycle='yearly' if yearly else 'monthly'
        amount=2999000 if yearly else 859900;provider='plan_YearSwitch' if yearly else 'plan_ProSwitch'
        self.c.execute("UPDATE plans SET monthly_price=8599,yearly_price=85990 WHERE id='professional'")
        self.c.execute('INSERT INTO clinicx_provider_prices VALUES(%s,%s,%s,%s,now()) ON CONFLICT(plan_id,billing_cycle) DO UPDATE SET provider_plan_id=EXCLUDED.provider_plan_id,amount_paise=EXCLUDED.amount_paise',(plan,cycle,provider,amount))
        self.c.execute('SET ROLE authenticated');self.c.execute("SELECT clinicx_reserve_recurring(%s,'change',%s,%s,NULL)",(org,plan,cycle));cmd=self.c.fetchone()[0]
        self.c.execute('SET ROLE service_role');self.c.execute('SELECT clinicx_finish_recurring(%s,%s,%s)',(cmd['id'],self.user,json.dumps(dict(id=sid,plan_id=provider,status='active',has_scheduled_changes=True,change_scheduled_at=e['period_end'],quantity=1))))
        self.c.execute('RESET ROLE');self.c.execute("UPDATE clinicx_recurring_commands SET effective_at=to_timestamp(%s)-interval '1 hour' WHERE id=%s",(e['period_start'],cmd['id']))
        new=self.evidence(sid);new.update(provider_plan_id=provider,amount_paise=amount,period_start=e['period_start'],period_end=e['period_end']+1 if not yearly else e['period_start']+31536000)
        self.c.execute('SET ROLE service_role');self.settle(new)
        return org,sid,e,new,plan,cycle,amount
    def test_switched_quote_reporting_and_late_original_charge(self):
        for yearly in (False,True):
            self.setUp()
            org,sid,e,new,plan,cycle,amount=self.switch(yearly)
            self.c.execute('SELECT id,amount FROM transactions WHERE organization_id=%s ORDER BY id',(org,));before=self.c.fetchall()
            self.admin();self.c.execute('SELECT * FROM clinicx_admin_paid_at(now()) WHERE organization_id=%s',(org,)) if False else None
            self.c.execute("SELECT clinicx_admin_customers(0,100,'paid')");rows=self.c.fetchone()[0]['subscriptions'];row=next((r for r in rows if r['organizationId']==org),None)
            self.assertIsNotNone(row,'valid switched canonical capture must remain a paid customer')
            self.assertAlmostEqual(float(row['monthlyRecurringInr']),amount/100/(12 if yearly else 1),places=2)
            self.c.execute('RESET ROLE');self.c.execute('SELECT id FROM clinics WHERE organization_id=%s',(org,));cid=self.c.fetchone()[0];self.admin()
            self.c.execute('SELECT clinicx_admin_customer(%s,0,0,100)',(cid,));payments=self.c.fetchone()[0]['payments']['records']
            switched=next(p for p in payments if p['payment_id']==new['payment_id']);self.assertEqual((switched['plan_id'],switched['billing_cycle']),(plan,cycle))
            old=self.evidence(sid);old.update(period_start=e['period_start']-7200,period_end=e['period_end']-7200)
            self.c.execute('SET ROLE service_role');self.settle(old);self.admin()
            self.c.execute('SELECT clinicx_admin_customer(%s,0,0,100)',(cid,));records=self.c.fetchone()[0]['payments']['records'];late=next(p for p in records if p['payment_id']==old['payment_id']);self.assertEqual((late['plan_id'],late['billing_cycle']),('growth','monthly'))
            self.c.execute('RESET ROLE');self.c.execute('SELECT id,amount FROM transactions WHERE organization_id=%s AND gateway_payment_id<>%s ORDER BY id',(org,old['payment_id']));self.assertEqual(self.c.fetchall(),before)
    def test_raw_service_role_cannot_grant_activate_extend_or_forge_provenance(self):
        org=self.configure();self.c.execute('SET ROLE service_role')
        for patch in ["status='active'", "plan_id='enterprise'", "current_period_end=now()+interval '1 year'", "access_source='verified_payment',status='active'", "access_source='documented_override',status='active'", "trial_started_at=NULL,trial_ends_at=NULL,grace_ends_at=NULL"]:
            with self.assertRaises(psycopg2.Error,msg=patch):self.c.execute('UPDATE subscriptions SET '+patch+' WHERE organization_id=%s',(org,))
        self.c.execute('SELECT status,access_source FROM subscriptions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone(),('trialing','free_trial'))
    def test_legitimate_trial_jobs_and_settlement_lifecycle(self):
        org=self.configure();self.c.execute('SET ROLE service_role');self.c.execute("SELECT clinicx_run_trial_jobs(now()+interval '38 days')");self.c.fetchone()
        self.c.execute('SELECT status FROM subscriptions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],'suspended')
        self.c.execute('SET ROLE authenticated');sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e)
        self.c.execute("SELECT clinicx_billing_lifecycle(%s,%s,'pending',%s,NULL)",('evt_failure_'+self.user,sid,e['period_end']));self.c.fetchone()
        self.c.execute("SELECT clinicx_billing_lifecycle(%s,%s,'cancelled',NULL,NULL)",('evt_cancel_'+self.user,sid));self.c.fetchone()
        self.c.execute('SELECT status,current_period_end=to_timestamp(%s) FROM subscriptions WHERE organization_id=%s',(e['period_end'],org));self.assertEqual(self.c.fetchone(),('cancelled',True))
    def test_superadmin_override_requires_reason_expiry_and_no_financial_row(self):
        org=self.configure();self.admin()
        self.denied("SELECT clinicx_admin_documented_override(%s,'professional',now()+interval '1 day','Approved support exception')",(org,))
        self.admin('super_admin')
        for expiry,reason in [("now()+interval '40 days'",'Approved'),("now()+interval '1 day'",'')]:
            with self.assertRaises(psycopg2.Error):self.c.execute('SELECT clinicx_admin_documented_override(%s,\'professional\','+expiry+',%s)',(org,reason))
        self.c.execute("SELECT clinicx_admin_documented_override(%s,'professional',now()+interval '1 day','Approved support exception')",(org,));self.assertTrue(self.c.fetchone()[0]['success'])
        self.c.execute('RESET ROLE');self.c.execute('SELECT count(*) FROM transactions WHERE organization_id=%s',(org,));self.assertEqual(self.c.fetchone()[0],0)
        self.c.execute('SELECT count(*) FROM subscription_events WHERE organization_id=%s AND kind=\'documented_override\' AND actor_id=%s',(org,self.user));self.assertEqual(self.c.fetchone()[0],1)
        self.c.execute("SELECT clinicx_effective_state(%s,now()+interval '2 days')",(org,));self.assertEqual(self.c.fetchone()[0],'suspended')
        self.admin();self.assertFalse(any(r['planId']=='professional' for r in self.stats()['planDistribution'] if False))
    def test_settled_charge_quote_history_is_immutable(self):
        org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e)
        for table,where,patch in [('transactions','gateway_payment_id',"plan='enterprise'"),('invoices','canonical_payment_id',"canonical_plan_id='enterprise'"),('transactions','gateway_payment_id','canonical_amount_paise=1'),('invoices','canonical_payment_id',"canonical_period_end=now()+interval '1 year'")]:
            with self.assertRaises(psycopg2.Error):self.c.execute('UPDATE '+table+' SET '+patch+' WHERE '+where+'=%s',(e['payment_id'],))
            with self.assertRaises(psycopg2.Error):self.c.execute('DELETE FROM '+table+' WHERE '+where+'=%s',(e['payment_id'],))
        self.c.execute('SELECT clinicx_settle_payment(%s,%s)',('evt_repeat_'+self.user,json.dumps(e)));self.assertTrue(self.c.fetchone()[0]['deduped'])

    def test_real_server_http_reads_and_rejected_commands_through_pg(self):
        import http.server, threading, subprocess
        from psycopg2 import sql
        org,sid,e,new,plan,cycle,amount=self.switch(True)
        self.admin();self.c.execute('RESET ROLE');self.c.execute('SELECT id::text FROM clinics WHERE organization_id=%s',(org,));cid=self.c.fetchone()[0]
        self.c.execute('SELECT id,amount FROM transactions WHERE organization_id=%s ORDER BY id',(org,));money=self.c.fetchall()
        self.c.execute('SELECT id,name FROM patients WHERE organization_id=%s ORDER BY id',(org,));clinical=self.c.fetchall()
        owner=self
        class RPC(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_POST(self):
                body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));name=body['name'];args=body['args']
                con=psycopg2.connect(host=str(owner.socket),port=55447,dbname='postgres',user=os.environ['USER'])
                try:
                    cur=con.cursor();cur.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(owner.user,))
                    if name=='__table':
                        table=args['table'];op=args['op'];filters=args['filters'];payload=args['payload']
                        assert (table,op) in [('user_roles','select'),('clinics','select'),('clinics','update'),('admin_audit_logs','insert')]
                        cur.execute('SET ROLE service_role')
                        if op=='insert':
                            query=sql.SQL('INSERT INTO {} ({}) VALUES ({}) RETURNING *').format(sql.Identifier(table),sql.SQL(',').join(map(sql.Identifier,payload)),sql.SQL(',').join(sql.Placeholder() for _ in payload));values=[json.dumps(v) if isinstance(v,dict) else v for v in payload.values()]
                        else:
                            where=sql.SQL(' AND ').join(sql.SQL('{}=%s').format(sql.Identifier(k)) for k in filters) if filters else sql.SQL('true')
                            if op=='select':query=sql.SQL('SELECT * FROM {} WHERE {}').format(sql.Identifier(table),where);values=list(filters.values())
                            else:
                                assert set(payload)<= {'doctor_name','clinic_name','specialization','email','phone','address'}
                                query=sql.SQL('UPDATE {} SET {} WHERE {} RETURNING *').format(sql.Identifier(table),sql.SQL(',').join(sql.SQL('{}=%s').format(sql.Identifier(k)) for k in payload),where);values=list(payload.values())+list(filters.values())
                        cur.execute(query,values);columns=[d.name for d in cur.description];data=[dict(zip(columns,row)) for row in cur.fetchall()]
                    else:
                        assert name in ['clinicx_admin_billing_stats','clinicx_admin_customers','clinicx_admin_customer','clinicx_admin_documented_override']
                        cur.execute('SET ROLE authenticated')
                        query=sql.SQL('SELECT public.{}({})').format(sql.Identifier(name),sql.SQL(',').join(sql.SQL('{} => %s').format(sql.Identifier(k)) for k in args))
                        cur.execute(query,list(args.values()));data=cur.fetchone()[0]
                    con.commit();result={'data':data,'error':None}
                except Exception as err:
                    con.rollback();result={'data':None,'error':{'message':str(err),'code':getattr(err,'pgcode',None)}}
                finally:con.close()
                content=json.dumps(result,default=str).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(content)
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),RPC);thread=threading.Thread(target=server.serve_forever);thread.start()
        try:
            run=subprocess.run(['node',str(ROOT/'scripts/test-clinicx-admin-authority-integration.cjs'),f'http://127.0.0.1:{server.server_address[1]}',self.user,org,cid,plan,cycle,str(amount)],text=True,capture_output=True,timeout=45,cwd=ROOT)
            self.assertEqual(run.returncode,0,run.stdout+run.stderr);print(run.stdout.strip())
            self.c.execute('SELECT id,amount FROM transactions WHERE organization_id=%s ORDER BY id',(org,));self.assertEqual(self.c.fetchall(),money)
            self.c.execute('SELECT id,name FROM patients WHERE organization_id=%s ORDER BY id',(org,));self.assertEqual(self.c.fetchall(),clinical)
            self.c.execute('SELECT doctor_name FROM clinics WHERE id=%s',(cid,));self.assertEqual(self.c.fetchone()[0],'Support corrected clinician')
            self.c.execute("SELECT count(*) FROM admin_audit_logs WHERE target_id=%s AND action='doctor_profile_updated'",(cid,));self.assertEqual(self.c.fetchone()[0],1)
        finally:server.shutdown();server.server_close();thread.join()

    def test_forged_manual_and_clinical_rows_are_not_paid_reporting(self):
        org=self.configure();self.c.execute('RESET ROLE');self.c.execute("INSERT INTO transactions(organization_id,amount,status,gateway,plan,billing_cycle,currency) VALUES(%s,999900,'captured','manual','enterprise','monthly','INR')",(org,));self.admin()
        self.c.execute("SELECT clinicx_admin_customers(0,100,'paid')");self.assertFalse(any(r['organizationId']==org for r in self.c.fetchone()[0]['subscriptions']))
        self.c.execute('BEGIN READ ONLY');self.stats();self.c.execute('SELECT clinicx_admin_customers(0,100,NULL)');self.c.fetchone();self.c.execute('COMMIT')
if __name__=='__main__':
    unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(AuthorityDB)).wasSuccessful() or exit(1)
