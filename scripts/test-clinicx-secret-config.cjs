#!/usr/bin/env node
// Offline contracts. Actual modules run in VM contexts with provider/DB transport replaced.
// Assertions never echo credential values, source lines, or command output.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function push(env) {
  const source = fs.readFileSync(path.join(root, 'src/lib/push.functions.ts'), 'utf8');
  const exports = {};
  const builder = () => ({ middleware() { return this; }, validator() { return this; }, handler(fn) { return fn; } });
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, {
    exports, process: { env }, require(name) {
      if (name === '@tanstack/react-start') return { createServerFn: builder };
      if (name === 'zod') return require('zod');
      if (name.includes('auth-middleware')) return { requireSupabaseAuth: {} };
      throw new Error('Unreviewed import blocked');
    },
  });
  return exports;
}
test('push configuration fails closed without private runtime configuration', async () => {
  for (const env of [{}, { VAPID_PUBLIC_KEY: 'fixture-public' }, { VAPID_PRIVATE_KEY: 'fixture-private' }, { VAPID_PUBLIC_KEY: ' ', VAPID_PRIVATE_KEY: ' ' }]) {
    const config = await push(env).getPushConfig();
    assert.ok(config.configured === false, 'missing or blank key pair must disable push');
    assert.ok(config.publicKey === '', 'unconfigured response must not advertise a fallback key');
  }
});
test('public environment guard accepts anon keys and rejects server credential exposure', async () => {
  assert.ok(fs.existsSync(path.join(__dirname, 'test-clinicx-secret-config.mjs')), 'public environment guard must exist before builds');
  const { publicEnvironmentFindings } = await import('./test-clinicx-secret-config.mjs');
  const jwt = role => ['eyJhbGciOiJub25lIn0', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'Zml4dHVyZQ'].join('.');
  const allowed = { VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', VITE_SUPABASE_ANON_KEY: jwt('anon'), VITE_RAZORPAY_KEY_ID: 'rzp_test_fixture' };
  assert.ok(publicEnvironmentFindings(allowed).length === 0, 'intentionally public identifiers must remain allowed');
  for (const entry of [{ VITE_VAPID_PRIVATE_KEY: 'fixture-private' }, { VITE_DATABASE_URL: 'fixture-private' }, { VITE_SUPABASE_KEY: jwt('service_role') }, { VITE_SUPABASE_KEY: 'sb_secret_fixture' }]) {
    const findings = publicEnvironmentFindings(entry);
    assert.ok(findings.length > 0, 'server-only public configuration must be rejected');
    assert.ok(!JSON.stringify(findings).includes('fixture-private'), 'findings must contain names and reasons only');
  }
});
test('backend development command no longer installs the vulnerable legacy watcher', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8'));
  assert.ok(manifest.scripts.dev === 'tsx watch src/index.ts', 'supported watcher must retain entrypoint and restart behavior');
  assert.ok(!manifest.devDependencies['ts-node-dev'], 'legacy watcher must be removed');
  assert.ok(Boolean(manifest.devDependencies.tsx), 'replacement watcher must be explicit');
});
function remote(env, fail = false, count = '1') {
  let calls = [], logs = [], error;
  const source = fs.readFileSync(path.join(root, 'scripts/apply-remote-migrations.mjs'), 'utf8');
  const invoke = (...args) => { calls.push(args); if (fail) throw new Error('fixture-private-database-output'); return count; };
  const context = { exports: {}, process: { env, exit() { throw new Error('exit'); } }, console: { log() {}, error(...args) { logs.push(args); } }, require(name) {
    if (name === 'node:child_process') return { execSync: invoke, execFileSync: invoke };
    if (name === 'node:fs') return { readdirSync: () => ['20261009100000_fixture.sql'] };
    if (name === 'node:path') return path;
    throw new Error('Unreviewed import blocked');
  }};
  try { vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, context); }
  catch (e) { error = e; }
  return { calls, logs, error };
}
test('remote migrations require explicit configuration and execution authorization', () => {
  for (const env of [{}, { REMOTE_DB_URL: 'postgresql://fixture:fixture@invalid.example/db' }, { REMOTE_DB_URL: ' ', CLINICX_ALLOW_REMOTE_MIGRATIONS: 'yes' }]) {
    const result = remote(env);
    assert.ok(result.calls.length === 0, 'missing configuration or approval must precede database access');
    assert.ok(Boolean(result.error) || result.logs.length > 0, 'refusal must be observable');
  }
});
test('remote migration credentials never enter shell commands or failure output', () => {
  const env = { REMOTE_DB_URL: 'postgresql://fixture:fixture-private@invalid.example/db', CLINICX_ALLOW_REMOTE_MIGRATIONS: 'yes' };
  const result = remote(env, true);
  assert.ok(result.calls.length === 1, 'one failing database attempt must stop processing');
  const [executable, argv, options] = result.calls[0];
  assert.ok(Array.isArray(argv), 'database child must use argument array, never shell concatenation');
  assert.ok(!JSON.stringify([executable, argv]).includes('fixture-private'), 'credentials must not be process arguments');
  assert.ok(options?.env?.PGDATABASE === env.REMOTE_DB_URL, 'explicit libpq environment must carry the connection string');
  assert.ok(!JSON.stringify(result.logs).includes('fixture-private'), 'provider output must not leak into logs');
});
test('push response exposes only public key and configured status', async () => {
  const config = await push({ VAPID_PUBLIC_KEY: 'fixture-public', VAPID_PRIVATE_KEY: 'fixture-private' }).getPushConfig();
  assert.ok(config.configured === true && config.publicKey === 'fixture-public', 'complete explicit pair must work');
  assert.ok(Object.keys(config).sort().join(',') === 'configured,publicKey', 'private key is never serialized');
  assert.ok(!JSON.stringify(config).includes('fixture-private'), 'private fixture must stay server-side');
});
test('authorized remote fixture preserves migration and cache-refresh flow without shell', () => {
  const result = remote({ REMOTE_DB_URL: 'postgresql://fixture:fixture@invalid.example/db', CLINICX_ALLOW_REMOTE_MIGRATIONS: 'yes' }, false, '0');
  assert.ok(!result.error && result.calls.length === 4, 'expected check, apply, record, and cache reload calls');
  assert.ok(result.calls.every(call => Array.isArray(call[1]) && call[1].includes('ON_ERROR_STOP=1')), 'all database operations fail on SQL errors');
  assert.ok(result.calls[1][1].includes('-f'), 'authorized migration file remains applied');
});
test('public-env CLI checks dotenv variants before build without echoing values', () => {
  const scratch = process.env.TMPDIR || os.tmpdir();
  assert.ok(scratch, 'test fixture requires approved scratch TMPDIR');
  const directory = fs.mkdtempSync(path.join(scratch, 'cxenv-'));
  const env = { PATH: process.env.PATH, HOME: directory, TMPDIR: directory };
  const command = path.join(__dirname, 'test-clinicx-secret-config.mjs');
  try {
    fs.writeFileSync(path.join(directory, '.env.production.local'), 'export VITE_VAPID_PRIVATE_KEY="fixture-private-cli"\n');
    let child = spawnSync(process.execPath, [command], { cwd: directory, env, encoding: 'utf8', timeout: 10000 });
    assert.ok(child.status === 1, 'private key in dotenv variant must block execution');
    assert.ok(!`${child.stdout}${child.stderr}`.includes('fixture-private-cli'), 'rejection must not disclose values');
    fs.unlinkSync(path.join(directory, '.env.production.local'));
    fs.writeFileSync(path.join(directory, '.env'), 'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture\n');
    child = spawnSync(process.execPath, [command], { cwd: directory, env, encoding: 'utf8', timeout: 10000 });
    assert.ok(child.status === 0, 'public publishable fixture must remain accepted');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('supported npm browser workflows invoke public-env preflight', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const name of ['dev', 'build', 'build:dev', 'preview']) {
    assert.ok(manifest.scripts[name].startsWith('node scripts/test-clinicx-secret-config.mjs && '), `${name} must guard public configuration before Vite`);
  }
});
