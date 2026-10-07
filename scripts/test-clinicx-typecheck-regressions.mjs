import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

function source(path) {
  if (process.env.CLINICX_TEST_BASELINE === '1') {
    return execFileSync('git', ['show', `HEAD:${path}`], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  }
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

// Exercise the actual route callbacks without booting auth or contacting providers.
function callback(path, name, globals) {
  const text = source(path);
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(initializer, `missing callback ${name}`);
  const code = ts.transpileModule(`const result = ${initializer.getText(file)}; result;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  return runInNewContext(code, globals);
}
function query(data = null) {
  // PostgrestBuilder implements PromiseLike, not Promise; its .then() need not expose .catch().
  const result = { data, error: null };
  const builder = { then: (ok, fail) => {
    const pending = Promise.resolve(result).then(ok, fail);
    return { then: pending.then.bind(pending) };
  } };
  for (const key of ['select', 'eq', 'gte', 'lte', 'neq', 'maybeSingle', 'upsert', 'order', 'limit', 'update', 'insert']) builder[key] = () => builder;
  return builder;
}
function appointmentGlobals(existing) {
  const errors = [], successes = [], opened = [], loading = [];
  let inserts = 0;
  const g = {
    clinic: { id: 'clinic', organization_id: 'org', consultation_fee: 500 },
    apptName: 'Patient', apptPhone: '9999999999', apptEmail: '', apptAge: '', apptGender: '',
    apptScheduledAt: '2026-10-07T10:00:00', apptType: 'offline', apptDoctorId: '', apptProblem: '', apptFee: '',
    toast: { error: m => errors.push(m), success: m => successes.push(m) },
    setLoading: v => loading.push(v), setAddOpen: v => opened.push(v),
    bookingFn: async () => {}, load: () => {},
    supabase: { from: table => {
      const b = query(table === 'appointments' ? existing : null);
      b.insert = () => { inserts++; return query({ id: 'created' }); };
      return b;
    } },
  };
  for (const key of ['Name', 'Phone', 'Email', 'Age', 'Gender', 'Problem']) g[`setAppt${key}`] = () => {};
  return { g, errors, successes, opened, loading, get inserts() { return inserts; } };
}

test('duplicate appointment closes the actual dialog without a ReferenceError', async () => {
  const state = appointmentGlobals({ id: 'duplicate', scheduled_at: '2026-10-07T10:00:00Z' });
  await callback('src/routes/_authenticated/dashboard.appointments.tsx', 'handleAddSubmit', state.g)({ preventDefault() {} });
  assert.equal(state.errors.length, 1, state.errors.join('\n'));
  assert.deepEqual(state.opened, [false]);
  assert.equal(state.inserts, 0);
  assert.equal(state.loading.at(-1), false);
});

test('legacy duplicate with null schedule does not invent epoch appointment time', async () => {
  const state = appointmentGlobals({ id: 'duplicate', scheduled_at: null });
  await callback('src/routes/_authenticated/dashboard.appointments.tsx', 'handleAddSubmit', state.g)({ preventDefault() {} });
  assert.equal(state.errors.length, 1, state.errors.join('\n'));
  assert.ok(!state.errors[0].includes('12:00'), state.errors[0]);
  assert.ok(!state.errors[0].includes('5:30'), state.errors[0]);
  assert.equal(state.inserts, 0);
});

test('patient directory best effort accepts genuine PromiseLike without catch', async () => {
  const state = appointmentGlobals(null);
  await callback('src/routes/_authenticated/dashboard.appointments.tsx', 'handleAddSubmit', state.g)({ preventDefault() {} });
  assert.deepEqual(state.errors, []);
  assert.equal(state.successes.length, 1);
  assert.deepEqual(state.opened, [false]);
});

test('queue load tolerates PromiseLike query results and keeps waiting patient identity', async () => {
  const errors = [], rows = [];
  const token = { id: 'walkin', token_number: 3, patient_name: 'Walk-in', patient_phone: null, status: 'waiting', priority: false, created_at: '2026-10-07T00:00:00Z' };
  await callback('src/routes/_authenticated/dashboard.queue.tsx', 'load', {
    orgId: 'org', clinicId: 'clinic', date: '2026-10-07', useCallback: fn => fn,
    supabase: { from: table => query(table === 'queue_tokens' ? [token] : []) },
    setLoading() {}, setPatients() {}, setQueueList: data => rows.push(...data),
    console: { error: (...args) => errors.push(args) },
  })();
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, token.id);
  assert.equal(rows[0].status, 'waiting');
});

test('consult load tolerates PromiseLike tokens and retains appointment ID for continuation', async () => {
  const errors = [], rows = [];
  const appt = { id: 'appointment', patient_name: 'Booked patient', patient_phone: '9999999999', status: 'confirmed', scheduled_at: '2026-10-07T10:00:00Z' };
  await callback('src/routes/_authenticated/dashboard.consult.tsx', 'loadData', {
    orgId: 'org', clinicId: 'clinic', useCallback: fn => fn, todayDateStr: () => '2026-10-07',
    supabase: { from: table => query(table === 'appointments' ? [appt] : []) },
    setLoading() {}, setPatients() {}, setHistoryRows() {}, setQueue: data => rows.push(...data),
    searchParams: {}, selectedPatient: null, selectPatient() {},
    console: { error: (...args) => errors.push(args) },
  })();
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].appointment_id, appt.id);
});

test('public booking live doctor refresh catches transport and processing failures', async () => {
  const path = 'src/routes/c.$slug.book.tsx';
  const file = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expr;
  function visit(node) {
    if (ts.isExpressionStatement(node) && /^(query\.then|Promise\.resolve\(query\)\.then)/.test(node.getText(file))) expr = node.expression;
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(expr);
  const code = ts.transpileModule(expr.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  await assert.doesNotReject(async () => {
    await runInNewContext(code, { query: query([{ id: 'doctor' }]), processDoctorList() { throw new Error('bad doctor payload'); } });
  });
});

test('queue token inserts never send columns absent from the queue migration', () => {
  const allowed = new Set(['organization_id', 'appointment_id', 'queue_date', 'token_number', 'patient_id', 'patient_name', 'patient_phone', 'status', 'priority', 'note']);
  const path = 'src/lib/clinic.functions.ts';
  const file = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true);
  let inserts = 0;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'insert') {
      const chain = node.expression.expression.getText(file);
      if (chain.includes('.from("queue_tokens"')) {
        inserts++;
        for (const prop of node.arguments[0].properties) {
          assert.ok(allowed.has(prop.name.getText(file)), `queue_tokens has no ${prop.name.getText(file)} column`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(inserts, 1);
});

test('generated clinical tables match migration columns, nullability, and required inserts', () => {
  const path = 'src/integrations/supabase/types.ts';
  const text = source(path);
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const db = file.statements.find(n => ts.isTypeAliasDeclaration(n) && n.name.text === 'Database').type;
  const member = (type, name) => type.members.find(n => n.name?.getText(file).replaceAll('"', '') === name)?.type;
  const tables = member(member(db, 'public'), 'Tables');
  for (const [table, migration] of [
    ['queue_tokens', '20260726150000_module_queue.sql'],
    ['patient_visits', '20260726150100_module_emr.sql'],
  ]) {
    const ddl = readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8');
    const block = ddl.split(`CREATE TABLE public.${table} (`)[1].split('\n);')[0];
    const cols = block.split('\n').map(l => l.trim()).filter(l => /^[a-z_][a-z0-9_]* (uuid|date|text|int|boolean|timestamptz|numeric)/.test(l));
    const shape = member(tables, table);
    assert.ok(shape, `missing table ${table}`);
    for (const kind of ['Row', 'Insert', 'Update']) {
      const fields = member(shape, kind).members;
      assert.deepEqual(fields.map(f => f.name.text).sort(), cols.map(l => l.split(' ')[0]).sort(), `${table}.${kind} columns`);
      for (const col of cols) {
        const [name, sqlType] = col.split(' ');
        const f = fields.find(f => f.name.text === name);
        const nullable = !col.includes('NOT NULL') && !col.includes('PRIMARY KEY');
        assert.equal(f.type.getText(file).includes('null'), nullable, `${table}.${kind}.${name} nullability`);
        assert.equal(!!f.questionToken, kind === 'Update' || kind === 'Insert' && (nullable || col.includes('DEFAULT')), `${table}.${kind}.${name} required`);
        const base = /^(int|numeric)/.test(sqlType) ? 'number' : sqlType === 'boolean' ? 'boolean' : 'string';
        assert.ok(f.type.getText(file).includes(base), `${table}.${name} type`);
      }
    }
  }
});

test('appointment enum union and Constants preserve old states and match forward migration', () => {
  const original = source('supabase/migrations/20260621120020_6fae4069-6f98-471a-87f7-125320de785a.sql');
  const oldStates = [...original.match(/CREATE TYPE public\.appointment_status AS ENUM \(([^;]+)\)/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const ddl = source('supabase/migrations/20261007110000_clinicx_appointment_states.sql');
  const added = [...ddl.matchAll(/ALTER TYPE public\.appointment_status ADD VALUE IF NOT EXISTS '([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(added, ['waiting', 'serving']);
  assert.doesNotMatch(ddl, /\b(DROP|RENAME|UPDATE|DELETE)\b/i);
  const text = source('src/integrations/supabase/types.ts');
  const file = ts.createSourceFile('types.ts', text, ts.ScriptTarget.Latest, true);
  const db = file.statements.find(n => ts.isTypeAliasDeclaration(n) && n.name.text === 'Database').type;
  const member = (type, name) => type.members.find(n => n.name?.getText(file).replaceAll('"', '') === name)?.type;
  const enumType = member(member(member(db, 'public'), 'Enums'), 'appointment_status');
  const union = enumType.types.map(t => t.literal.text);
  const constants = [...text.split('export const Constants =')[1].match(/appointment_status: \[([^\]]+)\]/)[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(union, [...oldStates, ...added]);
  assert.deepEqual(constants, union);
});

test('safe build and deployment configuration never opt into vulnerable TanStack output', () => {
  const manifest = JSON.parse(source('package.json'));
  const vercel = JSON.parse(source('vercel.json'));
  assert.equal(manifest.scripts.build, 'vite build');
  assert.equal(manifest.scripts['build:dev'], 'vite build --mode development');
  assert.ok(!JSON.stringify(vercel).includes('DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS'));
  assert.equal(manifest.dependencies['@tanstack/react-start'], '1.168.60');
  assert.equal(manifest.dependencies['@tanstack/react-router'], '1.170.41');
  assert.equal(manifest.dependencies['@tailwindcss/vite'], '4.3.0');
  assert.equal(manifest.devDependencies.vite, '8.0.16');
  assert.equal(manifest.engines.node, '>=22.12.0');
});

test('template preset updates structure and colors, preserving unrelated clinic content', () => {
  let updates;
  const apply = callback('src/features/website-builder/context/WebsiteBuilderContext.tsx', 'applyTemplatePreset', {
    useCallback: fn => fn, state: { design_tokens: { brandName: 'Existing clinic' } },
    patch: next => { updates = next; }, toast: { success() {} },
  });
  apply({ id: 'dental', name: 'Dental', category: 'dental', variants: { hero: 'split' }, colorPreset: { primary: '#123', secondary: '#456', accent: '#789' } });
  assert.equal(updates.template, 'dental');
  assert.equal(updates.design_tokens.brandName, 'Existing clinic');
  assert.equal(updates.theme_color, '#123');
  assert.equal(updates.design_tokens.secondaryColor, '#456');
});
