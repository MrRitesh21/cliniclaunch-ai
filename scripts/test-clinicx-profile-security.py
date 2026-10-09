"""Profile visibility contracts on a fresh synthetic PostgreSQL cluster.
Uses real profile-policy migrations, synthetic membership/auth, no remote DSN.
Not hosted Supabase Auth/PostgREST or full migration history verification.
"""
import getpass
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
os.environ['LC_ALL'] = 'C'
SCRATCH = Path(os.environ['CLINICX_TEST_TMPDIR'])
BIN = Path(os.environ.get('PG_BIN', '/opt/homebrew/opt/postgresql@17/bin'))
ACTORS = {name: f'00000000-0000-4000-8000-{number:012d}' for number, name in enumerate(['owner_a', 'staff_a', 'owner_b', 'platform_admin'], 1)}

class ProfileSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        SCRATCH.mkdir(parents=True, exist_ok=True)
        cls.work = Path(tempfile.mkdtemp(prefix='prof-', dir=SCRATCH))
        cls.data, cls.socket = cls.work/'data', cls.work/'s'
        cls.socket.mkdir()
        subprocess.run([str(BIN/'initdb'), '-D', str(cls.data), '-A', 'trust', '--no-locale', '-E', 'UTF8'], check=True, stdout=subprocess.DEVNULL)
        try:
            subprocess.run([str(BIN/'pg_ctl'), '-D', str(cls.data), '-l', str(cls.work/'postgres.log'), '-o', f"-k {cls.socket} -c listen_addresses='' -p 55441", '-w', 'start'], check=True, stdout=subprocess.DEVNULL)
            cls.started = True
            cls.con = psycopg2.connect(host=str(cls.socket), port=55441, dbname='postgres', user=getpass.getuser())
            cls.con.autocommit = True
            cls.cur = cls.con.cursor()
            cls.cur.execute("""
              CREATE EXTENSION pgcrypto;
              CREATE SCHEMA auth;
              CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
              GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
              CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
              CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
              CREATE TYPE public.user_role AS ENUM('doctor','reception');
              CREATE TABLE public.organization_members(organization_id uuid,user_id uuid,role text);
              ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
              CREATE POLICY own_membership ON public.organization_members FOR SELECT TO authenticated USING(user_id=auth.uid());
              GRANT SELECT ON public.organization_members TO authenticated;
              CREATE FUNCTION public.is_org_member(_org uuid,_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM organization_members WHERE organization_id=_org AND user_id=_user) $$;
              DROP POLICY own_membership ON public.organization_members;
              CREATE POLICY members_read ON public.organization_members FOR SELECT TO authenticated USING(public.is_org_member(organization_id,auth.uid()));
              CREATE FUNCTION public.is_admin(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT _user='00000000-0000-4000-8000-000000000004'::uuid $$;
            """)
            original=ROOT/'supabase/migrations/20260620070322_9edadd43-2704-4b10-8b74-731ef1cd99b3.sql'
            # Exact profiles DDL, grants and policies; no unrelated tables/auth triggers.
            cls.cur.execute('\n'.join(original.read_text().splitlines()[:15]))
            for name, actor in ACTORS.items():
                cls.cur.execute('INSERT INTO auth.users VALUES(%s,%s,%s)', (actor,name+'@example.invalid','{}'))
                cls.cur.execute('INSERT INTO profiles(id,full_name,role) VALUES(%s,%s,%s)', (actor,name,'doctor'))
            org_a='10000000-0000-4000-8000-000000000001'
            org_b='10000000-0000-4000-8000-000000000002'
            for name in ['owner_a','staff_a','owner_b']:
                cls.cur.execute('INSERT INTO organization_members VALUES(%s,%s,%s)',(org_b if name=='owner_b' else org_a,ACTORS[name],'staff' if name=='staff_a' else 'owner'))
            cls.cur.execute((ROOT/'supabase/migrations/20261008235500_clinicx_staff_profile_names.sql').read_text())
            correction=ROOT/'supabase/migrations/20261009130000_clinicx_profile_visibility.sql'
            if correction.exists():cls.cur.execute(correction.read_text())
        except BaseException:
            cls.cleanup()
            raise

    @classmethod
    def cleanup(cls):
        if getattr(cls,'con',None):cls.con.close()
        if getattr(cls,'started',False):
            subprocess.run([str(BIN/'pg_ctl'),'-D',str(cls.data),'-m','fast','-w','stop'],check=True,stdout=subprocess.DEVNULL)
            cls.started=False

    @classmethod
    def tearDownClass(cls):cls.cleanup()

    def setUp(self):
        self.cur.execute('RESET ROLE');self.cur.execute('BEGIN')

    def tearDown(self):self.cur.execute('ROLLBACK');self.cur.execute('RESET ROLE')

    def actor(self,name=None):
        self.cur.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(ACTORS[name] if name else '',))
        self.cur.execute('SET LOCAL ROLE '+('authenticated' if name else 'anon'))

    def visible(self):
        self.cur.execute('SELECT id,full_name FROM profiles ORDER BY full_name')
        return {str(row[0]):row[1] for row in self.cur.fetchall()}

    def test_anonymous_has_no_profile_access(self):
        self.actor()
        try:rows=self.visible()
        except psycopg2.Error as e:self.assertEqual(e.pgcode,'42501');return
        self.assertEqual(rows,{})

    def test_same_clinic_peer_names_remain_readable(self):
        self.actor('staff_a');self.assertEqual(self.visible(),{ACTORS['owner_a']:'owner_a',ACTORS['staff_a']:'staff_a'})

    def test_other_clinic_cannot_read_foreign_profiles(self):
        self.actor('owner_b');self.assertEqual(self.visible(),{ACTORS['owner_b']:'owner_b'})

    def test_platform_admin_directory_remains_readable(self):
        self.actor('platform_admin');self.assertEqual(len(self.visible()),4)

    def test_peer_name_update_is_denied(self):
        self.actor('staff_a');self.cur.execute("UPDATE profiles SET full_name='changed' WHERE id=%s RETURNING id",(ACTORS['owner_a'],));self.assertEqual(self.cur.fetchall(),[])

    def test_own_name_update_remains_permitted(self):
        self.actor('staff_a')
        self.cur.execute("UPDATE profiles SET full_name='updated' WHERE id=%s RETURNING full_name", (ACTORS['staff_a'],))
        row = self.cur.fetchone()
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row[0], 'updated')

    def test_no_rows_removed_by_forward_migration(self):
        self.cur.execute('SELECT count(*) FROM profiles')
        row = self.cur.fetchone()
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row[0], 4)

if __name__=='__main__':unittest.main(verbosity=2)
