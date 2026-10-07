#!/usr/bin/env python3
"""Exercise the real appointment enum migration in an isolated native PostgreSQL cluster.
No production URL, credentials, Docker, or network listener is used.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PG = Path(os.environ.get('PG_BIN', '/opt/homebrew/opt/postgresql@17/bin'))
SCRATCH = Path(os.environ.get('TMPDIR', '/Users/ritesh/.hermes/profiles/sara/cache/scratch'))
SCRATCH.mkdir(parents=True, exist_ok=True)


def run(args, **kwargs):
    return subprocess.run([str(x) for x in args], check=True, text=True, capture_output=True,
                          env={**os.environ, 'LC_ALL': 'C', 'LANG': 'C'}, **kwargs).stdout


with tempfile.TemporaryDirectory(prefix='ca-', dir=SCRATCH) as tmp:
    tmp = Path(tmp)
    data = tmp / 'data'
    run([PG / 'initdb', '-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale'])
    # The unique socket directory isolates this test from every other local cluster.
    try:
        run([PG / 'pg_ctl', '-D', data, '-l', tmp / 'postgres.log', '-o', f"-F -k {tmp} -c listen_addresses=''", '-w', 'start'])
    except subprocess.CalledProcessError:
        print((tmp / 'postgres.log').read_text())
        raise
    try:
        psql = [PG / 'psql', '-X', '-h', tmp, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']

        def sql(statement):
            return run(psql, input=statement).strip()

        original = (ROOT / 'supabase/migrations/20260621120020_6fae4069-6f98-471a-87f7-125320de785a.sql').read_text()
        match = re.search(r'CREATE TYPE public\.appointment_status AS ENUM \([^;]+;', original)
        assert match is not None, 'baseline appointment enum DDL missing'
        enum_ddl = match[0]
        old_states = re.findall(r"'([^']+)'", enum_ddl)
        sql(enum_ddl + "\nCREATE TABLE appointments_fixture (id int PRIMARY KEY, status public.appointment_status NOT NULL DEFAULT 'pending');\n"
            + "INSERT INTO appointments_fixture SELECT ordinality::int, state FROM unnest(enum_range(NULL::public.appointment_status)) WITH ORDINALITY AS x(state, ordinality);")
        before = sql('SELECT json_agg(t ORDER BY id) FROM appointments_fixture t;')
        before_oids = sql("SELECT json_object_agg(enumlabel, oid) FROM pg_enum WHERE enumtypid = 'public.appointment_status'::regtype;")
        rejected = subprocess.run(psql, input="INSERT INTO appointments_fixture VALUES (6, 'waiting');", text=True, capture_output=True)
        assert rejected.returncode != 0 and 'invalid input value for enum' in rejected.stderr, rejected.stderr
        migration = ROOT / 'supabase/migrations/20261007110000_clinicx_appointment_states.sql'
        # --single-transaction commits the enum additions before later statements consume them.
        run([*psql, '--single-transaction', '-f', migration])
        assert sql('SELECT json_agg(t ORDER BY id) FROM appointments_fixture t;') == before
        after_oids = json.loads(sql("SELECT json_object_agg(enumlabel, oid) FROM pg_enum WHERE enumtypid = 'public.appointment_status'::regtype;"))
        assert all(after_oids[k] == v for k, v in json.loads(before_oids).items())
        states = json.loads(sql('SELECT to_json(enum_range(NULL::public.appointment_status));'))
        assert states == old_states + ['waiting', 'serving'], states
        sql("INSERT INTO appointments_fixture VALUES (6, 'waiting'), (7, 'serving'); UPDATE appointments_fixture SET status = 'serving' WHERE id = 6;")
        assert sql("SELECT count(*) FROM appointments_fixture WHERE status = 'serving';") == '2'
        rows = sql('SELECT json_agg(t ORDER BY id) FROM appointments_fixture t;')
        run([*psql, '--single-transaction', '-f', migration])
        assert sql('SELECT json_agg(t ORDER BY id) FROM appointments_fixture t;') == rows
        assert json.loads(sql('SELECT to_json(enum_range(NULL::public.appointment_status));')) == states
        sql('INSERT INTO appointments_fixture (id) VALUES (8);')
        assert sql('SELECT status FROM appointments_fixture WHERE id = 8;') == 'pending'
        print(json.dumps({'passed': True, 'states': states, 'old_rows_and_enum_oids_preserved': True,
                          'idempotent_rerun': True, 'committed_new_states_usable': True, 'default_preserved': True}))
    finally:
        run([PG / 'pg_ctl', '-D', data, '-m', 'fast', '-w', 'stop'])
