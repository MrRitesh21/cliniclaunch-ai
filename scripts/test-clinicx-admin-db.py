"""Native PG17 selected-schema admin regressions, Unix socket only; no remote DSNs."""
import importlib.util
import json
from pathlib import Path
import unittest
import uuid
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('payment_fixture', ROOT/'scripts/test-clinicx-payments-db.py')
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)

class AdminDB(unittest.TestCase):
    stop_cluster = classmethod(fixture.PaymentsDB.stop_cluster.__func__)
    @classmethod
    def setUpClass(cls):
        fixture.PaymentsDB.setUpClass.__func__(cls)
        cls.c.execute("DROP FUNCTION public.is_admin(uuid) CASCADE")
        p = next((ROOT/'supabase/migrations').glob('20260628060119_*.sql'))
        cls.c.execute(p.read_text())
        for p in sorted((ROOT/'supabase/migrations').glob('2026100715*.sql')):
            cls.c.execute('BEGIN'); cls.c.execute(p.read_text()); cls.c.execute('COMMIT')
    def setUp(self):
        fixture.SubscriptionDB.setUp(self)
    provision = fixture.SubscriptionDB.provision
    denied = fixture.SubscriptionDB.denied
    configure = fixture.PaymentsDB.configure
    reserve = fixture.PaymentsDB.reserve
    bind = fixture.PaymentsDB.bind
    def evidence(self, sid, pid=None):
        e = fixture.PaymentsDB.evidence(self, sid, pid)
        # PG bigint rounds epoch; ensure this fixture's period has already begun.
        e['period_start'] -= 1
        e['period_end'] -= 1
        return e
    settle = fixture.PaymentsDB.settle
    def require_feature(self):
        self.c.execute("SELECT to_regprocedure('clinicx_admin_billing_stats()')")
        self.assertIsNotNone(self.c.fetchone()[0], 'read-only database admin billing authority missing')
    def admin(self, role='support'):
        self.c.execute('RESET ROLE')
        self.c.execute('INSERT INTO user_roles(user_id,role) VALUES(%s,%s) ON CONFLICT DO NOTHING',(self.user,role))
        self.c.execute('SET ROLE authenticated')
    def stats(self):
        self.c.execute('SELECT clinicx_admin_billing_stats()'); return self.c.fetchone()[0]
    def test_admin_role_not_org_role_or_client_flags(self):
        self.require_feature(); org=self.configure()
        self.denied('SELECT clinicx_admin_billing_stats()')
        self.c.execute("SELECT set_config('request.jwt.claim.is_superadmin','true',false)")
        self.denied('SELECT clinicx_admin_customers(0,50,NULL)')
        self.admin(); self.assertGreaterEqual(self.stats()['totalClinics'],1)
        self.c.execute('RESET ROLE');self.c.execute('DELETE FROM user_roles WHERE user_id=%s',(self.user,));self.c.execute('SET ROLE authenticated')
        self.denied('SELECT clinicx_admin_billing_stats()')
    def test_anonymous_and_foreign_tenant_customer_detail_denied(self):
        self.require_feature(); a=self.configure(); self.c.execute('RESET ROLE')
        self.c.execute('SELECT id FROM clinics WHERE organization_id=%s',(a,)); cid=self.c.fetchone()[0]
        other=str(uuid.uuid4());self.c.execute('INSERT INTO auth.users(id) VALUES(%s)',(other,))
        self.c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(other,));self.c.execute('SET ROLE authenticated')
        self.user=other;other_org=self.provision()['organization_id']
        self.c.execute('SELECT clinicx_subscription_snapshot(%s)',(other_org,));self.assertEqual(self.c.fetchone()[0]['organization_id'],other_org)
        self.denied('SELECT clinicx_admin_customer(%s,0,0,20)',(cid,))
        self.c.execute('SET ROLE anon');self.denied('SELECT clinicx_admin_billing_stats()')
    def test_captured_monthly_not_trials_legacy_or_clinical_revenue(self):
        self.require_feature();org=self.configure();sid=self.bind(self.reserve(org));self.settle(self.evidence(sid));self.admin()
        before=self.stats();self.assertGreaterEqual(before['mrr'],2999)
        self.c.execute('RESET ROLE');self.c.execute("INSERT INTO patients(organization_id,name) VALUES(%s,'Fixture patient') RETURNING id",(org,));pid=self.c.fetchone()[0]
        self.c.execute("INSERT INTO patient_invoices(organization_id,patient_id,patient_name,invoice_number,total) VALUES(%s,%s,'Fixture patient',%s,990000)",(org,pid,'SYN-'+uuid.uuid4().hex))
        self.c.execute('SET ROLE authenticated');self.assertEqual(self.stats()['mrr'],before['mrr'])
        self.c.execute('RESET ROLE');self.c.execute("INSERT INTO clinicx_analytics_cohorts(organization_id,cohort,reason) VALUES(%s,'test','Synthetic exclusion')",(org,));self.c.execute('SET ROLE authenticated')
        after=self.stats();self.assertAlmostEqual(before['mrr']-after['mrr'],2999)
        self.assertEqual(after['arr'],round(after['mrr']*12,2))
    def test_yearly_normalized_from_canonical_capture_not_current_list(self):
        self.require_feature();org=self.configure();self.c.execute('RESET ROLE')
        self.c.execute("INSERT INTO clinicx_provider_prices VALUES('growth','yearly','plan_Year',2999000,now()) ON CONFLICT DO NOTHING")
        self.c.execute('SET ROLE authenticated');self.c.execute("SELECT clinicx_begin_checkout(%s,'growth','yearly')",(org,));a=self.c.fetchone()[0]
        sid=self.bind(a);e=self.evidence(sid);e.update(provider_plan_id='plan_Year',amount_paise=2999000,period_end=e['period_start']+31536000)
        self.admin();before=self.stats()['mrr'];self.c.execute('SET ROLE service_role');self.settle(e);self.admin()
        self.assertAlmostEqual(self.stats()['mrr']-before,29990/12,places=2)
        self.c.execute('RESET ROLE');self.c.execute("UPDATE plans SET yearly_price=59990 WHERE id='growth'");self.c.execute('SET ROLE authenticated')
        self.assertAlmostEqual(self.stats()['mrr']-before,29990/12,places=2)
        self.c.execute('RESET ROLE');self.c.execute("UPDATE plans SET yearly_price=29990 WHERE id='growth'")
    def test_exclusion_fields_are_not_owner_or_support_editable(self):
        self.require_feature();org=self.configure()
        self.denied("INSERT INTO clinicx_analytics_cohorts VALUES(%s,'internal','attack',now())",(org,))
        self.admin();self.denied("UPDATE clinicx_analytics_cohorts SET cohort='production'")
    def test_pages_totals_boundaries_and_no_patient_pii(self):
        self.require_feature();org=self.configure();self.admin()
        self.c.execute('SELECT clinicx_admin_customers(0,1,NULL)');first=self.c.fetchone()[0]
        self.assertEqual(len(first['subscriptions']),1);self.assertEqual(first['hasMore'],first['totalCount']>1)
        self.c.execute('SELECT clinicx_admin_customers(1,1,NULL)');second=self.c.fetchone()[0]
        self.assertEqual(first['totalCount'],second['totalCount']);self.assertNotEqual(first['subscriptions'][0]['clinicId'],second['subscriptions'][0]['clinicId'])
        self.c.execute('RESET ROLE');self.c.execute('SELECT id FROM clinics WHERE organization_id=%s',(org,));cid=self.c.fetchone()[0];self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_admin_customer(%s,0,0,1)',(cid,));detail=self.c.fetchone()[0]
        if __import__('os').environ.get('CLINICX_ADMIN_CAPTURE'):
            Path(__import__('os').environ['CLINICX_ADMIN_CAPTURE']).write_text(json.dumps({'stats':self.stats(),'page':first,'detail':detail}))
        self.assertEqual(detail['usage']['patients'],0);self.assertIn('trial_started_at',detail['subscription'])
        self.assertNotIn('patient_name',json.dumps(detail));self.assertNotIn('patients',detail.keys())
        with self.assertRaises(psycopg2.Error):self.c.execute('SELECT clinicx_admin_customers(-1,501,NULL)')
    def test_read_only_transaction_and_no_events_or_receipts_written(self):
        self.require_feature();org=self.configure();self.admin()
        self.c.execute('SELECT count(*) FROM subscription_events');before=self.c.fetchone()[0]
        self.c.execute('BEGIN READ ONLY');self.stats();self.c.execute('SELECT clinicx_admin_customers(0,10,NULL)');self.c.fetchone();self.c.execute('COMMIT')
        self.c.execute('SELECT count(*) FROM subscription_events');self.assertEqual(self.c.fetchone()[0],before)
    def test_paid_period_exact_boundary_and_churn_formula(self):
        self.require_feature();org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e);self.admin()
        before=self.stats();self.c.execute('RESET ROLE')
        self.c.execute("UPDATE subscriptions SET current_period_end=now() WHERE organization_id=%s",(org,));self.c.execute('SET ROLE authenticated')
        self.assertEqual(before['paidCustomers']-self.stats()['paidCustomers'],1)

    def test_conversion_matured_trials_recorded_capture_window_and_exclusions(self):
        self.require_feature();org=self.configure()
        fixture.SubscriptionDB.travel(self,org,38)
        self.admin();before=self.stats()
        self.assertGreaterEqual(before['eligibleCompletedTrials'],1)
        self.c.execute('RESET ROLE');self.c.execute('SELECT trial_ends_at FROM subscriptions WHERE organization_id=%s',(org,));end=self.c.fetchone()[0]
        self.c.execute('SET ROLE authenticated');sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e)
        self.c.execute('RESET ROLE');self.c.execute('UPDATE transactions SET created_at=%s WHERE organization_id=%s',(end,org));self.admin()
        after=self.stats();self.assertEqual(after['convertedTrials']-before['convertedTrials'],1)
        self.assertEqual(after['conversionRate'],round(after['convertedTrials']*100/after['eligibleCompletedTrials'],2))
        self.c.execute('RESET ROLE');self.c.execute("UPDATE transactions SET created_at=%s+interval '7 days 1 second' WHERE organization_id=%s",(end,org));self.admin()
        self.assertEqual(self.stats()['convertedTrials'],before['convertedTrials'])
        self.c.execute('RESET ROLE');self.c.execute("INSERT INTO clinicx_analytics_cohorts(organization_id,cohort,reason) VALUES(%s,'fraud','Reviewed synthetic fraud')",(org,));self.admin()
        self.assertEqual(self.stats()['eligibleCompletedTrials'],before['eligibleCompletedTrials']-1)
    def test_opening_paid_logo_churn_not_status_updated_time(self):
        self.require_feature();org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid)
        self.c.execute("SELECT extract(epoch from now()-interval '35 days')::bigint,extract(epoch from now()-interval '5 days')::bigint");e['period_start'],e['period_end']=self.c.fetchone()
        self.settle(e);self.admin();before=self.stats()
        self.assertGreaterEqual(before['openingPaidCustomers'],1);self.assertGreaterEqual(before['churnedCustomers'],1)
        self.assertEqual(before['churnRate'],round(before['churnedCustomers']*100/before['openingPaidCustomers'],2))
        self.c.execute('RESET ROLE');self.c.execute("UPDATE subscriptions SET status='active',updated_at=now() WHERE organization_id=%s",(org,));self.admin()
        self.assertEqual(self.stats()['churnedCustomers'],before['churnedCustomers'])
    def test_internal_exclusion_and_failed_payment_events(self):
        self.require_feature();org=self.configure();sid=self.bind(self.reserve(org));e=self.evidence(sid);self.settle(e)
        self.c.execute("SELECT clinicx_billing_lifecycle('evt_admin_failure',%s,'pending',%s,NULL)",(sid,e['period_end']))
        self.admin();before=self.stats();self.assertGreaterEqual(before['failedPayments'],1)
        self.c.execute('RESET ROLE');self.c.execute("INSERT INTO clinicx_analytics_cohorts(organization_id,cohort,reason) VALUES(%s,'internal','Reviewed synthetic internal')",(org,));self.admin();after=self.stats()
        self.assertEqual(before['failedPayments']-after['failedPayments'],1)
        self.assertEqual(before['paidCustomers']-after['paidCustomers'],1)
    def test_plan_distribution_counts_paid_customers_once_and_preserves_legacy(self):
        self.require_feature();self.configure();self.admin();stats=self.stats()
        self.assertEqual(sum(d['customers'] for d in stats['planDistribution']),stats['paidCustomers'])
        self.c.execute('RESET ROLE');self.c.execute('SELECT id,plan_id,status,trial_ends_at,current_period_end,razorpay_subscription_id FROM subscriptions WHERE organization_id=%s',(self.legacy_org,));self.assertEqual(self.c.fetchone(),self.legacy_before)

    def test_owner_identity_is_canonical_account_not_clinician_name(self):
        self.require_feature();org=self.configure();self.admin()
        self.c.execute('RESET ROLE');self.c.execute("UPDATE auth.users SET email='synthetic-owner@example.test' WHERE id=%s",(self.user,))
        self.c.execute("INSERT INTO profiles(id,full_name) VALUES(%s,'Synthetic Owner') ON CONFLICT(id) DO UPDATE SET full_name=EXCLUDED.full_name",(self.user,))
        self.c.execute("UPDATE clinics SET doctor_name='Synthetic clinician' WHERE organization_id=%s RETURNING id",(org,));cid=self.c.fetchone()[0]
        self.admin();self.c.execute('SELECT clinicx_admin_customer(%s,0,0,10)',(cid,));detail=self.c.fetchone()[0]
        self.assertIn('owner',detail,'Customer owner must come from the canonical account, not clinician display name')
        self.assertEqual(detail['owner'],{'id':self.user,'name':'Synthetic Owner','email':'synthetic-owner@example.test'})

if __name__=='__main__': unittest.main(verbosity=2)
