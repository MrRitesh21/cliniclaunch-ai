"""Cumulative 13/14/16/17/19 selected-schema PostgreSQL; no remote DSN, no sends."""
import importlib.util
import pathlib
import unittest
import uuid
ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('payments', ROOT/'scripts/test-clinicx-payments-db.py')
payments = importlib.util.module_from_spec(spec)
spec.loader.exec_module(payments)
Base = payments.PaymentsDB
class EngagementSafetyDB(unittest.TestCase):
    stop_cluster = classmethod(Base.stop_cluster.__func__)
    @classmethod
    def setUpClass(cls):
        payments.PaymentsDB.setUpClass.__func__(cls)
        for prefix in ['2026100716','2026100717','2026100719']:
            for p in sorted((ROOT/'supabase/migrations').glob(prefix+'*.sql')):
                cls.c.execute('BEGIN'); cls.c.execute(p.read_text()); cls.c.execute('COMMIT')
    setUp = Base.setUp
    provision = Base.provision
    denied = Base.denied
    configure = Base.configure
    reserve = Base.reserve
    bind = Base.bind
    evidence = Base.evidence
    settle = Base.settle
    travel = payments.SubscriptionDB.travel
    def delivery(self):
        org = self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE auth.users SET email='safety@example.invalid',email_confirmed_at=now() WHERE id=%s",(self.user,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_set_engagement_email(%s,true)',(org,))
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT clinicx_prepare_notification_delivery(100)')
        self.c.execute('SELECT clinicx_claim_notification_delivery(50)')
        jobs = self.c.fetchone()[0]
        job = next(j for j in jobs if j['to']=='safety@example.invalid')
        return org,job
    def test_immediate_preflight_suppresses_actively_leased_revoked_consent(self):
        org,job = self.delivery()
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_set_engagement_email(%s,false)',(org,))
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT clinicx_preflight_notification_delivery(%s,%s)',(job['id'],job['lease_token']))
        self.assertEqual(self.c.fetchone()[0],'suppressed')
        self.c.execute('SELECT completed_at IS NOT NULL,lease_token IS NULL FROM clinicx_notification_delivery WHERE id=%s',(job['id'],))
        self.assertEqual(self.c.fetchone(),(True,True))
        self.c.execute('SELECT clinicx_finish_notification_delivery(%s,%s,true)',(job['id'],job['lease_token']))
        self.assertFalse(self.c.fetchone()[0])
    def test_late_first_execution_records_all_six_exact_checkpoints_without_stale_notices(self):
        org=self.provision()['organization_id']
        self.travel(org,30)
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT trial_started_at,trial_ends_at,grace_ends_at FROM subscriptions WHERE organization_id=%s',(org,))
        before=self.c.fetchone()
        for _ in range(2): self.c.execute('SELECT clinicx_run_trial_jobs()')
        self.c.execute("SELECT kind,extract(epoch from effective_at-%s)/86400,details->'usage'->>'window' FROM subscription_events WHERE organization_id=%s AND kind LIKE 'trial_day_%%' ORDER BY effective_at",(before[0],org))
        rows=self.c.fetchall()
        self.assertEqual([r[0] for r in rows],['trial_day_'+str(d) for d in [0,7,15,21,25,28]])
        self.assertEqual([int(r[1]) for r in rows],[0,7,15,21,25,28])
        self.assertTrue(all(r[2]=='trial' for r in rows))
        self.c.execute('SELECT clinicx_prepare_notification_delivery(100)')
        self.c.execute("SELECT meta->>'kind' FROM notifications WHERE organization_id=%s",(org,))
        self.assertEqual(self.c.fetchall(),[('trial_expired',)])
        self.c.execute('SELECT trial_started_at,trial_ends_at,grace_ends_at FROM subscriptions WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchone(),before)
    def test_caller_clock_cannot_accelerate_trial_jobs(self):
        org=self.provision()['organization_id']
        self.c.execute('SET ROLE service_role')
        self.c.execute("SELECT clinicx_run_trial_jobs(now()+interval '100 days')")
        self.c.execute('RESET ROLE')
        self.c.execute('SELECT status FROM subscriptions WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchone()[0],'trialing')
        self.c.execute("SELECT count(*) FROM subscription_events WHERE organization_id=%s AND kind='trial_expired'",(org,))
        self.assertEqual(self.c.fetchone()[0],0)
    def previous_activity(self,org):
        self.travel(org,2)
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE clinicx_activation_days SET activity_day=(now() AT TIME ZONE 'UTC')::date-1,first_activity_at=now()-interval '1 day' WHERE organization_id=%s",(org,))
    def test_meaningful_patient_update_counts_new_utc_day(self):
        org=self.provision()['organization_id']
        self.c.execute("INSERT INTO patients(organization_id,name,created_at) VALUES(%s,'Synthetic old',now()-interval '1 day') RETURNING id",(org,))
        patient=self.c.fetchone()[0]
        self.previous_activity(org)
        self.c.execute("UPDATE patients SET name='Synthetic changed' WHERE id=%s",(patient,))
        self.c.execute('SELECT clinicx_trial_usage(%s)',(org,))
        self.assertEqual(self.c.fetchone()[0]['days_active'],2)
    def test_noop_clinic_update_does_not_count_active_day(self):
        org=self.provision()['organization_id']
        self.c.execute("UPDATE clinics SET specialization='Synthetic specialization' WHERE organization_id=%s",(org,))
        self.previous_activity(org)
        self.c.execute('UPDATE clinics SET clinic_name=clinic_name WHERE organization_id=%s',(org,))
        self.c.execute('SELECT clinicx_trial_usage(%s)',(org,))
        self.assertEqual(self.c.fetchone()[0]['days_active'],1)
    def test_initial_failed_checkout_notice_survives_trial_state_then_success_suppresses(self):
        org=self.configure(); sid=self.bind(self.reserve(org))
        self.c.execute("SELECT clinicx_billing_lifecycle(%s,%s,'pending',NULL,NULL)",('evt_'+uuid.uuid4().hex,sid))
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE auth.users SET email='failure@example.invalid',email_confirmed_at=now() WHERE id=%s",(self.user,))
        self.c.execute('SET ROLE authenticated')
        self.c.execute('SELECT clinicx_set_engagement_email(%s,true)',(org,))
        self.c.execute('RESET ROLE')
        self.c.execute("SELECT id,clinicx_notification_is_current(id) FROM subscription_outbox WHERE organization_id=%s AND kind='payment_failed'",(org,))
        outbox,current=self.c.fetchone(); self.assertTrue(current)
        for _ in range(2): self.c.execute('SELECT clinicx_prepare_notification_delivery(100)')
        self.c.execute("SELECT count(*) FROM notifications WHERE organization_id=%s AND meta->>'kind'='payment_failed'",(org,))
        self.assertEqual(self.c.fetchone()[0],1)
        self.c.execute('SELECT status,recovery_ends_at FROM subscriptions WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchone(),('trialing',None))
        self.c.execute('SELECT clinicx_claim_notification_delivery(50)')
        self.assertTrue(any(j['to']=='failure@example.invalid' for j in self.c.fetchone()[0]))
        self.c.execute('SET ROLE service_role'); self.settle(self.evidence(sid))
        self.c.execute('RESET ROLE'); self.c.execute('SELECT clinicx_notification_is_current(%s)',(outbox,))
        self.assertFalse(self.c.fetchone()[0])
    def test_per_record_created_events_are_separate_from_first_activation_and_phi_free(self):
        org=self.provision()['organization_id']
        for n in range(2):
            self.c.execute("INSERT INTO patients(organization_id,name) VALUES(%s,'SYNTHETIC-PHI') RETURNING id",(org,)); patient=self.c.fetchone()[0]
            self.c.execute("INSERT INTO appointments(organization_id,patient_id,patient_name,appointment_date,appointment_time) VALUES(%s,%s,'SYNTHETIC-PHI',current_date,'10:00')",(org,patient))
            self.c.execute("INSERT INTO prescriptions(organization_id,patient_id,patient_name) VALUES(%s,%s,'SYNTHETIC-PHI')",(org,patient))
            self.c.execute("INSERT INTO patient_invoices(organization_id,patient_id,patient_name,invoice_number,total) VALUES(%s,%s,'SYNTHETIC-PHI',%s,100)",(org,patient,'safety-'+uuid.uuid4().hex))
        self.c.execute('RESET ROLE')
        self.c.execute("SELECT kind,count(*) FROM subscription_events WHERE organization_id=%s GROUP BY kind",(org,))
        counts=dict(self.c.fetchall())
        for k in ['patient','appointment','prescription','invoice']:
            self.assertEqual(counts.get(k+'_created'),2)
            self.assertEqual(counts.get('first_'+k),1)
        self.c.execute('SELECT details FROM subscription_events WHERE organization_id=%s',(org,))
        self.assertNotIn('SYNTHETIC-PHI',str(self.c.fetchall()))
        self.c.execute('SET ROLE authenticated'); self.c.execute('SELECT clinicx_trial_engagement(%s)',(org,))
        dto=self.c.fetchone()[0]; self.assertNotIn(patient,str(dto)); self.assertNotIn('SYNTHETIC-PHI',str(dto))
    def test_meaningful_mutation_audit_is_internal_and_noops_do_not_emit(self):
        org=self.provision()['organization_id']
        self.c.execute("INSERT INTO patients(organization_id,name) VALUES(%s,'Synthetic') RETURNING id",(org,)); patient=self.c.fetchone()[0]
        self.c.execute("UPDATE patients SET name='Synthetic changed' WHERE id=%s",(patient,))
        self.c.execute('UPDATE patients SET name=name WHERE id=%s',(patient,))
        self.denied('SELECT * FROM clinicx_product_mutations')
        self.c.execute('RESET ROLE')
        self.c.execute("SELECT operation,record_id,details FROM clinicx_product_mutations WHERE organization_id=%s AND source_table='patients' ORDER BY recorded_at",(org,))
        rows=self.c.fetchall()
        self.assertEqual([r[0] for r in rows],['INSERT','UPDATE'])
        self.assertTrue(all(r[1]==patient for r in rows))
        self.assertTrue(all(r[2]=={'source':'database_mutation'} for r in rows))
    def test_authoritative_checkout_and_onboarding_events_are_repeat_safe(self):
        org=self.configure(); attempt=self.reserve(org); self.bind(attempt)
        self.c.execute('SET ROLE authenticated'); self.reserve(org)
        self.c.execute('UPDATE organization_onboarding SET completed=true WHERE organization_id=%s',(org,))
        self.c.execute('UPDATE organization_onboarding SET completed=true WHERE organization_id=%s',(org,))
        self.c.execute('RESET ROLE')
        self.c.execute("SELECT kind,count(*) FROM subscription_events WHERE organization_id=%s GROUP BY kind",(org,)); counts=dict(self.c.fetchall())
        for kind in ['upgrade_clicked','checkout_started','onboarding_started','onboarding_completed']: self.assertEqual(counts.get(kind),1)
    def test_owner_consent_read_is_independent_durable_default_off_and_role_scoped(self):
        org=self.provision()['organization_id']
        self.c.execute('SELECT clinicx_get_engagement_email(%s)',(org,)); first=self.c.fetchone()[0]
        self.assertEqual(first,dict(organization_id=org,user_id=self.user,email_enabled=False,updated_at=None))
        for enabled in [True,False]:
            self.c.execute('SELECT clinicx_set_engagement_email(%s,%s)',(org,enabled)); ack=self.c.fetchone()[0]
            self.c.execute('SELECT clinicx_get_engagement_email(%s)',(org,)); read=self.c.fetchone()[0]
            self.assertEqual(read['email_enabled'],enabled); self.assertIsNotNone(read['updated_at']); self.assertEqual(read,ack)
        self.denied('SELECT clinicx_get_engagement_email(%s)',(str(uuid.uuid4()),))
        self.denied('SELECT * FROM clinicx_engagement_preferences')
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE organization_members SET role='staff' WHERE organization_id=%s AND user_id=%s",(org,self.user))
        self.c.execute('SET ROLE authenticated')
        self.denied('SELECT clinicx_get_engagement_email(%s)',(org,))
        self.denied('SELECT clinicx_set_engagement_email(%s,true)',(org,))
        self.c.execute('RESET ROLE'); self.c.execute("SELECT set_config('request.jwt.claim.sub','',false)"); self.c.execute('SET ROLE authenticated')
        self.denied('SELECT clinicx_get_engagement_email(%s)',(org,))
del Base  # Imported unittest classes are not part of this suite.
if __name__ == '__main__': unittest.main(verbosity=2)
