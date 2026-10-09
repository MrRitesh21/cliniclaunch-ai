"""Attendance contracts on an owned Unix-socket PG cluster. No remote DSNs or env files."""
import importlib.util
import pathlib
import unittest
import uuid
import psycopg2

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('subscription_fixture', ROOT/'scripts/test-clinicx-subscription-db.py')
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)

class AttendanceDB(unittest.TestCase):
    stop_cluster = classmethod(fixture.SubscriptionDB.stop_cluster.__func__)
    setUp = fixture.SubscriptionDB.setUp
    provision = fixture.SubscriptionDB.provision
    travel = fixture.SubscriptionDB.travel
    denied = fixture.SubscriptionDB.denied

    @classmethod
    def setUpClass(cls):
        fixture.SubscriptionDB.setUpClass.__func__(cls)
        # Selected-schema fixture permits multiple branches like the current application contract.
        cls.c.execute('ALTER TABLE clinics DROP CONSTRAINT clinics_organization_id_key')
        cls.c.execute((ROOT/'supabase/migrations/20261009110000_clinicx_staff_attendance.sql').read_text())
        corrective = ROOT/'supabase/migrations/20261009120000_clinicx_attendance_authority.sql'
        if corrective.exists():
            cls.c.execute('BEGIN')
            cls.c.execute(corrective.read_text())
            cls.c.execute('COMMIT')

    def test_direct_table_write_is_denied_even_for_owner(self):
        org = self.provision()['organization_id']
        self.denied("INSERT INTO staff_attendance(organization_id,staff_id,staff_name) VALUES(%s,'forged','Forged')", (org,))

    def install(self, org):
        self.c.execute("INSERT INTO organization_modules(organization_id,module_id) VALUES(%s,'attendance')", (org,))

    def read_day(self, org, day=None, clinic=None):
        self.c.execute("SELECT clinicx_attendance_day(%s,%s,%s)", (org,day,clinic))
        return self.c.fetchone()[0]

    def punch(self, org, subject=None, action='check_in', day=None, status=None, shift='morning', notes=None):
        self.c.execute("SELECT clinicx_attendance_record(%s,%s,%s,%s,%s,%s,%s)", (org,subject,action,day,status,shift,notes))
        return self.c.fetchone()[0]

    def test_install_open_self_check_in_out_uses_canonical_identity(self):
        org = self.provision()['organization_id']
        self.c.execute("SELECT count(*) FROM modules WHERE id='attendance'")
        self.assertEqual(self.c.fetchone()[0],1,'Attendance must be registered in the App Store')
        self.install(org)
        initial = self.read_day(org)
        self.assertEqual(initial['timezone'], 'Asia/Kolkata')
        self.assertTrue(initial['can_manage'])
        self.assertEqual(initial['roster'][0]['staff_id'], 'user:'+self.user)
        row = self.punch(org)
        self.assertEqual(row['staff_id'], 'user:'+self.user)
        self.assertNotEqual(row['staff_name'], 'Forged')
        self.assertEqual(row['attendance_date'], initial['today'])
        again = self.punch(org)
        self.assertEqual(again['check_in'],row['check_in'])
        out = self.punch(org,action='check_out')
        self.assertGreaterEqual(out['check_out'],out['check_in'])
        self.assertEqual(self.punch(org,action='check_out')['check_out'],out['check_out'])
        self.assertEqual(len(self.read_day(org)['records']),1)
        import os, json
        if os.environ.get('CLINICX_ATTENDANCE_CAPTURE'):
            capture=pathlib.Path(os.environ['CLINICX_ATTENDANCE_CAPTURE']).resolve()
            assert capture.is_relative_to(pathlib.Path('/Users/ritesh/.hermes/profiles/sara/cache/scratch'))
            capture.write_text(json.dumps({'day':self.read_day(org),'row':out}))

    def as_user(self, user):
        self.c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)", (user or '',))
        self.c.execute('SET ROLE authenticated')

    def add_member(self, org, role='staff', clinic=None):
        user=str(uuid.uuid4())
        self.c.execute('RESET ROLE')
        self.c.execute('INSERT INTO auth.users(id) VALUES(%s)',(user,))
        self.c.execute("INSERT INTO profiles(id,full_name) VALUES(%s,'Same name')",(user,))
        self.c.execute('INSERT INTO organization_members(organization_id,user_id,role,clinic_id) VALUES(%s,%s,%s,%s)',(org,user,role,clinic))
        self.as_user(self.user)
        return user

    def test_moved_member_cannot_checkout_retry_outside_current_clinic(self):
        org=self.provision()['organization_id']; self.install(org)
        self.c.execute('SELECT id FROM clinics WHERE organization_id=%s',(org,)); clinic=self.c.fetchone()[0]
        staff=self.add_member(org,clinic=clinic)
        self.as_user(staff); row=self.punch(org); self.punch(org,action='check_out')
        self.as_user(self.user); self.c.execute('RESET ROLE')
        self.c.execute("INSERT INTO clinics(organization_id,slug,clinic_name) VALUES(%s,%s,'Other branch') RETURNING id",(org,'other-'+staff))
        other=self.c.fetchone()[0]
        self.c.execute('UPDATE organization_members SET clinic_id=%s WHERE user_id=%s',(other,staff))
        self.as_user(staff)
        self.denied('SELECT clinicx_attendance_record(%s,NULL,\'check_out\')',(org,))

    def test_staff_is_self_only_and_cannot_forge_status_or_subject(self):
        org=self.provision()['organization_id']; self.install(org)
        staff=self.add_member(org); self.as_user(staff)
        snapshot=self.read_day(org)
        self.assertFalse(snapshot['can_manage'])
        self.assertEqual([r['staff_id'] for r in snapshot['roster']],['user:'+staff])
        self.punch(org)
        self.denied("SELECT clinicx_attendance_record(%s,%s,'check_in')",(org,'user:'+self.user))
        self.denied("SELECT clinicx_attendance_record(%s,NULL,'set_status',current_date,'absent')",(org,))
        self.c.execute('SELECT staff_id FROM staff_attendance WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchall(),[('user:'+staff,)])

    def test_long_shift_completed_today_retry_preserves_clinic_scope(self):
        org=self.provision()['organization_id']; self.install(org)
        self.c.execute('SELECT id FROM clinics WHERE organization_id=%s',(org,)); clinic=self.c.fetchone()[0]
        staff=self.add_member(org,clinic=clinic)
        self.as_user(staff); row=self.punch(org)
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE staff_attendance SET attendance_date=(now() AT TIME ZONE 'Asia/Kolkata')::date-2,check_in=now()-interval '48 hours' WHERE id=%s",(row['id'],))
        self.as_user(staff); out=self.punch(org,action='check_out')
        self.assertEqual(self.punch(org,action='check_out'),out)
        self.as_user(self.user); self.c.execute('RESET ROLE')
        self.c.execute("INSERT INTO clinics(organization_id,slug,clinic_name) VALUES(%s,%s,'Other branch') RETURNING id",(org,'other-'+staff))
        other=self.c.fetchone()[0]
        self.c.execute('UPDATE organization_members SET clinic_id=%s WHERE user_id=%s',(other,staff))
        self.as_user(staff)
        self.denied("SELECT clinicx_attendance_record(%s,NULL,'check_out')",(org,))

    def test_missing_install_disabled_feature_wrong_tenant_and_missing_jwt_denied(self):
        org=self.provision()['organization_id']
        self.denied('SELECT clinicx_attendance_day(%s)',(org,))
        self.denied('SELECT clinicx_attendance_record(%s)',(org,))
        self.install(org)
        self.denied('SELECT clinicx_attendance_day(%s)',(str(uuid.uuid4()),))
        self.denied('SELECT clinicx_attendance_record(%s)',(str(uuid.uuid4()),))
        self.as_user(None); self.denied('SELECT clinicx_attendance_day(%s)',(org,)); self.denied('SELECT clinicx_attendance_record(%s)',(org,))
        self.as_user(self.user)
        self.c.execute('RESET ROLE'); self.c.execute("UPDATE modules SET is_available=false WHERE id='attendance'")
        self.as_user(self.user); self.denied('SELECT clinicx_attendance_day(%s)',(org,))
        self.c.execute('RESET ROLE'); self.c.execute("UPDATE modules SET is_available=true WHERE id='attendance'")

    def test_grace_is_read_and_csv_only_then_expiry_closes_reads(self):
        org=self.provision()['organization_id']; self.install(org); self.punch(org)
        self.travel(org,30)
        self.assertFalse(self.read_day(org)['can_write'])
        self.assertEqual(len(self.read_day(org)['records']),1)
        self.denied('SELECT clinicx_attendance_record(%s)',(org,))
        self.travel(org,37)
        self.denied('SELECT clinicx_attendance_day(%s)',(org,))
        self.c.execute('SELECT count(*) FROM staff_attendance WHERE organization_id=%s',(org,))
        self.assertEqual(self.c.fetchone()[0],0)

    def test_roster_dedupes_explicit_user_ids_not_names(self):
        org=self.provision()['organization_id']; self.install(org)
        staff=self.add_member(org,'doctor'); another=self.add_member(org)
        self.c.execute('RESET ROLE')
        self.c.execute("INSERT INTO doctors(organization_id,user_id,name) VALUES(%s,%s,'Same name'),(%s,NULL,'Same name') RETURNING id",(org,staff,org))
        doctors=[str(r[0]) for r in self.c.fetchall()]
        self.as_user(self.user)
        ids=[r['staff_id'] for r in self.read_day(org)['roster']]
        self.assertEqual(len(ids),4) # owner, two members, standalone doctor
        self.assertIn('user:'+staff,ids); self.assertIn('user:'+another,ids)
        self.assertNotIn('doctor:'+doctors[0],ids); self.assertIn('doctor:'+doctors[1],ids)

    def test_scoped_admin_cannot_manage_other_clinic_or_unassigned_members(self):
        org=self.provision()['organization_id']; self.install(org)
        self.c.execute('SELECT id FROM clinics WHERE organization_id=%s',(org,)); clinic=self.c.fetchone()[0]
        admin=self.add_member(org,'admin',clinic); staff=self.add_member(org,clinic=clinic); unassigned=self.add_member(org)
        self.as_user(admin)
        self.assertEqual({r['staff_id'] for r in self.read_day(org)['roster']},{'user:'+admin,'user:'+staff})
        self.punch(org,'user:'+staff)
        self.denied('SELECT clinicx_attendance_record(%s,%s)',(org,'user:'+unassigned))
        self.denied('SELECT clinicx_attendance_day(%s,NULL,%s)',(org,str(uuid.uuid4())))

    def test_status_history_preserves_punches_and_rejects_client_clock_input(self):
        org=self.provision()['organization_id']; self.install(org)
        snapshot=self.read_day(org); today=snapshot['today']; row=self.punch(org)
        corrected=self.punch(org,action='set_status',day=today,status='late',notes='Traffic',shift='full_day')
        self.assertEqual(corrected['check_in'],row['check_in']); self.assertEqual(corrected['status'],'late')
        self.assertEqual(corrected['notes'],'Traffic')
        for kwargs in [dict(day=today),dict(status='late'),dict(notes='manual')]:
            with self.assertRaises(psycopg2.Error) as raised: self.punch(org,**kwargs)
            self.assertEqual(raised.exception.pgcode,'22023')
        for status in ['absent','on_leave']:
            with self.assertRaises(psycopg2.Error): self.punch(org,action='set_status',day=today,status=status)
        self.c.execute("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date-1"); yesterday=self.c.fetchone()[0]
        for status in ['present','late','half_day','absent','on_leave']:
            saved=self.punch(org,action='set_status',day=yesterday,status=status)
            self.assertEqual(saved['status'],status)
            self.assertIsNone(saved['check_in'])
        self.assertEqual(len(self.read_day(org,yesterday)['records']),1)

    def test_checkout_without_in_and_backwards_clock_are_rejected(self):
        org=self.provision()['organization_id']; self.install(org)
        with self.assertRaises(psycopg2.Error) as raised: self.punch(org,action='check_out')
        self.assertEqual(raised.exception.pgcode,'22023')
        row=self.punch(org)
        self.c.execute('RESET ROLE'); self.c.execute("UPDATE staff_attendance SET check_in=now()+interval '1 hour' WHERE id=%s",(row['id'],)); self.as_user(self.user)
        with self.assertRaises(psycopg2.Error) as raised: self.punch(org,action='check_out')
        self.assertEqual(raised.exception.pgcode,'22023')

    def test_forgotten_120_hour_shift_can_checkout(self):
        org=self.provision()['organization_id']; self.install(org); row=self.punch(org)
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE staff_attendance SET attendance_date=(now() AT TIME ZONE 'Asia/Kolkata')::date-5,check_in=now()-interval '120 hours' WHERE id=%s",(row['id'],))
        self.as_user(self.user)
        out=self.punch(org,action='check_out')
        self.assertEqual(out['id'],row['id'])
        self.assertGreaterEqual(float(out['working_hours']),120)
        self.assertIsNotNone(out['check_out'])
        self.assertEqual(self.read_day(org,out['attendance_date'])['records'][0]['check_out'],out['check_out'])
        self.assertEqual(self.punch(org,action='check_out'),out)

    def test_48_hour_checkout_retry_keeps_original_day(self):
        org=self.provision()['organization_id']; self.install(org); row=self.punch(org)
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE staff_attendance SET attendance_date=(now() AT TIME ZONE 'Asia/Kolkata')::date-2,check_in=now()-interval '48 hours' WHERE id=%s",(row['id'],))
        self.as_user(self.user)
        out=self.punch(org,action='check_out')
        retry=self.punch(org,action='check_out')
        self.assertEqual(retry,out,'Immediate retry must return the completed long-running shift unchanged')
        self.assertEqual(out['id'],row['id'])
        self.assertGreaterEqual(float(out['working_hours']),48)

    def test_overnight_checkout_keeps_original_day(self):
        org=self.provision()['organization_id']; self.install(org); row=self.punch(org,shift='night')
        self.c.execute('RESET ROLE')
        self.c.execute("UPDATE staff_attendance SET attendance_date=(now() AT TIME ZONE 'Asia/Kolkata')::date-1,check_in=now()-interval '8 hours' WHERE id=%s",(row['id'],))
        self.as_user(self.user)
        original=self.punch(org,shift='night'); self.assertEqual(original['id'],row['id'])
        out=self.punch(org,action='check_out'); self.assertEqual(out['attendance_date'],original['attendance_date'])
        self.assertGreaterEqual(float(out['working_hours']),8)
        self.assertEqual(self.punch(org,action='check_out')['check_out'],out['check_out'])

    def test_paid_plan_catalog_matches_staff_and_unentitled_install_grants_nothing(self):
        org=self.provision()['organization_id']; self.install(org)
        self.c.execute('SELECT module_ids FROM plans ORDER BY id')
        for (modules,) in self.c.fetchall(): self.assertEqual('attendance' in modules,'staff' in modules or 'staff_management' in modules)
        self.c.execute('RESET ROLE')
        self.c.execute("ALTER TABLE subscriptions DISABLE TRIGGER ALL; UPDATE subscriptions SET status='active',plan_id='starter',access_source='verified_payment',current_period_end=now()+interval '1 year' WHERE organization_id=%s; ALTER TABLE subscriptions ENABLE TRIGGER ALL",(org,))
        self.as_user(self.user)
        self.denied('SELECT clinicx_attendance_record(%s)',(org,)); self.denied('SELECT clinicx_attendance_day(%s)',(org,))

    def test_unentitled_attendance_install_is_denied_by_database(self):
        org=self.provision()['organization_id']
        self.c.execute('RESET ROLE')
        self.c.execute("ALTER TABLE subscriptions DISABLE TRIGGER ALL; UPDATE subscriptions SET status='active',plan_id='starter',access_source='verified_payment',current_period_end=now()+interval '1 year' WHERE organization_id=%s; ALTER TABLE subscriptions ENABLE TRIGGER ALL",(org,))
        self.as_user(self.user)
        self.denied("INSERT INTO organization_modules(organization_id,module_id) VALUES(%s,'attendance')",(org,))

    def test_concurrent_check_in_is_exactly_once(self):
        import concurrent.futures
        import threading
        org=self.provision()['organization_id']; self.install(org)
        barrier=threading.Barrier(2)
        def check_in():
            con=psycopg2.connect(host=str(self.socket),port=55447,dbname='postgres',user='ritesh')
            try:
                cursor=con.cursor(); cursor.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(self.user,)); cursor.execute('SET ROLE authenticated')
                barrier.wait(timeout=10)
                cursor.execute('SELECT clinicx_attendance_record(%s)',(org,)); result=cursor.fetchone()[0]; con.commit(); return result
            finally: con.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(lambda _:check_in(),range(2)))
        self.assertEqual(results[0]['id'],results[1]['id']); self.assertEqual(results[0]['check_in'],results[1]['check_in'])
        self.assertEqual(len(self.read_day(org)['records']),1)

if __name__ == '__main__':
    unittest.main(verbosity=2)
