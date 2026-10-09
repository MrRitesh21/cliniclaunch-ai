// Offline contracts: native Request/Response; framework and Redis transport doubled.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = p => fs.readFileSync(path.join(root, p), 'utf8');
function load(p, doubles = {}, env = {}) {
  const module = { exports: {} };
  const requireDouble = name => {
    if (Object.hasOwn(doubles, name)) return doubles[name];
    if (name === 'node:net') return require(name);
    throw new Error(`Transport/import denied: ${name}`);
  };
  const code = ts.transpileModule(source(p), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: requireDouble, process: { env: { NODE_ENV: 'test', ...env } }, Request, Response, Headers, URL, performance, console: { error() {}, warn() {} } }, { filename: p, timeout: 5000 });
  return module.exports;
}
function scale(env = {}) { return load('src/lib/scale.server.ts', { './redis': { redisCache: { isReady: () => false } } }, env); }
const req = (p, headers = {}, method = 'GET') => new Request(`https://clinic.example${p}`, { headers, method });
test('sensitive extension paths never bypass rate limits or become public static', () => {
  const s = scale();
  for (const p of ['/api/private/report.json', '/_serverFn/fixture.json', '/dashboard/private.js', '/admin/users.css', '/consult/token.png', '/login.css', '/r/token.svg', '/l/token.js', '/invite/token.jpg']) {
    assert.equal(s.isInfraPath(p), false, p);
    assert.match(s.edgeCachePolicy(req(p), new URL(req(p).url)).cacheControl, /private.*no-store/, p);
  }
  for (const p of ['/assets/app-AbCd1234.js', '/icon-192.png', '/robots.txt', '/api/public/healthz']) assert.equal(s.isInfraPath(p), true, p);
  assert.equal(s.isInfraPath('/unknown.js'), false);
});
test('personalized requests and token query strings are private before static extension rules', () => {
  const s = scale();
  for (const [p, h] of [['/', { authorization: 'Bearer fixture' }], ['/assets/app-AbCd1234.js', { cookie: 'session=fixture' }], ['/c/demo?token=fixture', {}], ['/login', {}], ['/signup', {}], ['/c/demo/book', {}], ['/c/demo?preview=1', {}], ['/c/demo?unknown=value', {}]]) {
    const r = req(p, h); assert.match(s.edgeCachePolicy(r, new URL(r.url)).cacheControl, /private.*no-store/, p);
  }
  for (const p of ['/', '/c/demo', '/features', '/assets/app-AbCd1234.js', '/icon-192.png']) assert.match(s.edgeCachePolicy(req(p), new URL(req(p).url)).cacheControl, /public/, p);
  assert.match(s.edgeCachePolicy(req('/unknown'), new URL(req('/unknown').url)).cacheControl, /private/);
  assert.match(s.edgeCachePolicy(req('/', {}, 'POST'), new URL(req('/').url)).cacheControl, /no-store/);
});
function server(handler, onCaptured = () => {}) {
  return load('src/server.ts', {
    './lib/error-capture': { consumeLastCapturedError: () => { onCaptured(); return new Error('other-request fixture'); } },
    './lib/error-page': { renderErrorPage: () => '<html>generic error fixture</html>' },
    './lib/scale.server': scale(), './lib/env.server': { validateServerEnv() {} },
    '@tanstack/react-start/server-entry': { __esModule: true, default: { fetch: handler } },
  }).default;
}
test('server preserves response privacy and safely merges Vary', async () => {
  for (const h of [{ 'set-cookie': 'session=fixture', 'cache-control': 'public, max-age=60' }, { 'cache-control': 'private, max-age=90', 'cdn-cache-control': 'public, max-age=999' }, { 'cache-control': 'no-store' }, { 'vary': 'Cookie' }, { 'vary': '*' }, { 'cdn-cache-control': 'no-store' }, { 'vercel-cdn-cache-control': 'no-store' }]) {
    const r = await server(() => new Response('fixture', { headers: h })).fetch(req('/'), {}, {});
    assert.match(r.headers.get('cache-control'), /private.*no-store/, JSON.stringify(h));
    for (const header of ['cdn-cache-control','cloudflare-cdn-cache-control','vercel-cdn-cache-control']) assert.equal(r.headers.get(header), 'no-store');
    if (h['set-cookie']) assert.equal(r.headers.get('set-cookie'), h['set-cookie']);
    if (h.vary) assert.equal(r.headers.get('vary'), h.vary);
  }
  const r = await server(() => new Response('public', { headers: { vary: 'Accept-Language', 'content-type': 'text/html' } })).fetch(req('/'), {}, {});
  assert.match(r.headers.get('cache-control'), /public/);
  assert.match(r.headers.get('vary'), /Accept-Language/i); assert.match(r.headers.get('vary'), /Accept-Encoding/i);
  for (const headers of [{ cookie: 'fixture=1' }, { authorization: 'Bearer fixture' }]) {
    const r = await server(() => new Response('private')).fetch(req('/', headers), {}, {});
    assert.match(r.headers.get('cache-control'), /private.*no-store/);
  }
});
test('server denies file exposure before handler but allows well-known public resources', async () => {
  let called = 0; const s = server(() => { called++; return new Response('legitimate'); });
  for (const p of ['/.env', '/.env.production', '/.git/config', '/%2eenv', '/%252eenv', '/assets/private.js.map', '/sessions/creds.json', '/.wwebjs_auth/creds.json', '/node_modules/private.js', '/bad%encoding']) {
    const r = await s.fetch(req(p), {}, {}); assert.equal(r.status, 404, p); assert.match(r.headers.get('cache-control'), /no-store/);
  }
  assert.equal(called, 0);
  assert.equal((await s.fetch(req('/.well-known/openid-configuration'), {}, {})).status, 200); assert.equal(called, 1);
});
test('safe compatible security headers do not authorize arbitrary Vercel tenants', async () => {
  const r = await server(() => new Response('fixture')).fetch(req('/'), {}, {});
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /base-uri 'self'/); assert.match(csp, /object-src 'none'/); assert.match(csp, /frame-ancestors 'self'/); assert.doesNotMatch(csp, /\*\.vercel\.app/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.notEqual(r.headers.get('x-xss-protection'), '1; mode=block');
  assert.match(r.headers.get('permissions-policy'), /camera=\(self\)/); assert.match(r.headers.get('permissions-policy'), /microphone=\(self\)/);
  assert.equal(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});
test('catastrophic SSR normalization never consumes cross-request captured errors', async () => {
  let captured = 0;
  const r = await server(() => new Response('{"unhandled":true,"message":"HTTPError"}', { status: 500, headers: { 'content-type': 'application/json' } }), () => captured++).fetch(req('/'), {}, {});
  assert.equal(captured, 0);
  assert.equal(r.status, 500); assert.match(r.headers.get('cache-control'), /no-store/);
});
test('untrusted forwarding headers share one anonymous rate budget', async () => {
  const s = scale();
  for (let i = 0; i < 11; i++) {
    const r = req('/login', { 'cf-connecting-ip': `192.0.2.${i}`, 'x-real-ip': `198.51.100.${i}`, 'x-forwarded-for': `203.0.113.${i}` });
    assert.equal(await s.callerIp(r), 'anon');
    assert.equal((await s.checkRequestLimit(r, '/login')).allowed, i < 10);
  }
});
test('only configured deployment proxy headers identify a valid bounded IP', async () => {
  const vercel = scale({ VERCEL: '1' });
  assert.equal(await vercel.callerIp(req('/', { 'x-vercel-forwarded-for': '192.0.2.4', 'cf-connecting-ip': '198.51.100.1' })), '192.0.2.4');
  assert.equal(await vercel.callerIp(req('/', { 'x-forwarded-for': '192.0.2.4' })), 'anon');
  const sealed = scale({ CLINICX_TRUSTED_PROXY_HEADER: 'cf-connecting-ip' });
  assert.equal(await sealed.callerIp(req('/', { 'cf-connecting-ip': '2001:DB8::1' })), '2001:db8::1');
  for (const ip of ['999.1.1.1', '192.0.2.4, 192.0.2.5', 'not-an-ip', 'a'.repeat(100), '[::1]', 'fe80::1%en0']) assert.equal(await vercel.callerIp(req('/', { 'x-vercel-forwarded-for': ip })), 'anon', ip);
  assert.equal(await scale({ CLINICX_TRUSTED_PROXY_HEADER: 'authorization' }).callerIp(req('/', { authorization: '192.0.2.4' })), 'anon');
});
function worker() {
  const handlers = {}; const stores = new Map(); const deleted = []; const fetched = [];
  const key = r => typeof r === 'string' ? new URL(r, 'https://clinic.example').href : r.url;
  const storage = {
    open: async name => { if (!stores.has(name)) stores.set(name, new Map()); const items = stores.get(name); return { put: async (r, v) => items.set(key(r), v), match: async r => items.get(key(r)), delete: async r => items.delete(key(r)), addAll: async paths => { for (const p of paths) items.set(key(p), new Response('precache')); } }; },
    keys: async () => [...stores.keys()], delete: async name => { deleted.push(name); return stores.delete(name); },
    match: async r => { for (const s of stores.values()) if (s.has(key(r))) return s.get(key(r)); },
  };
  let network = () => { throw new Error('network fixture not set'); };
  const context = { self: { location: { origin: 'https://clinic.example' }, addEventListener: (n, fn) => handlers[n] = fn, skipWaiting() {}, clients: { claim() {} } }, caches: storage, URL, Request, Response, Headers, fetch: async r => { fetched.push(r); return network(r); } };
  vm.runInNewContext(source('public/sw.js'), context, { timeout: 5000 });
  return { handlers, stores, deleted, fetched, setNetwork: fn => network = fn,
    async dispatch(name, request) { const waits = []; let response; handlers[name]({ request, waitUntil: p => waits.push(p), respondWith: p => response = p }); const result = response ? await response : undefined; await Promise.all(waits); return result; },
  };
}
const swResponse = (cc = 'public, max-age=3600') => { const r = new Response('public asset', { headers: { 'cache-control': cc, 'content-type': 'image/png' } }); Object.defineProperty(r, 'type', { value: 'basic' }); return r; };
test('service-worker bypasses private, token, cross-origin and unknown resources', async () => {
  const w = worker(); w.setNetwork(() => swResponse());
  for (const p of ['/dashboard', '/dashboard/private.js', '/login', '/consult/token', '/r/token', '/api/report.json', '/_serverFn/fixture.json', '/c/demo?token=x', '/icon-192.png?token=x', '/unknown.js', 'https://foreign.example/icon-192.png']) {
    const r = p.startsWith('https:') ? new Request(p) : req(p);
    assert.equal(await w.dispatch('fetch', r), undefined, p);
  }
  assert.equal(await w.dispatch('fetch', req('/icon-192.png', { authorization: 'Bearer fixture' })), undefined);
  assert.equal(await w.dispatch('fetch', req('/icon-192.png', { cookie: 'fixture=1' })), undefined);
  assert.equal(w.fetched.length, 0);
});
test('service-worker stores only explicit public static responses and respects cache directives', async () => {
  const w = worker(); w.setNetwork(() => swResponse());
  assert.equal((await w.dispatch('fetch', req('/icon-192.png'))).status, 200);
  assert.equal([...w.stores.values()].reduce((n, s) => n + s.size, 0), 1);
  for (const cc of ['private, max-age=99', 'no-store', 'no-cache', 'max-age=30']) {
    const fresh = worker(); fresh.setNetwork(() => swResponse(cc)); await fresh.dispatch('fetch', req('/icon-192.png'));
    assert.equal([...fresh.stores.values()].reduce((n, s) => n + s.size, 0), 0, cc);
  }
});
test('service-worker activation deletes only old ClinicX owned caches', async () => {
  const w = worker(); w.stores.set('clinicx-pwa-v7', new Map()); w.stores.set('other-app-cache', new Map());
  await w.dispatch('activate'); assert.equal(w.stores.has('clinicx-pwa-v7'), false); assert.equal(w.stores.has('other-app-cache'), true);
});
test('service-worker public install and offline shell never recover private old root HTML', async () => {
  const w = worker(); w.stores.set('clinicx-pwa-v7', new Map([['https://clinic.example/', new Response('PRIVATE OLD ROOT')]]));
  w.setNetwork(() => { throw new Error('offline'); });
  await w.dispatch('install');
  for (const [name, store] of w.stores) if (name !== 'clinicx-pwa-v7') assert.equal(store.has('https://clinic.example/'), false);
  const r = await w.dispatch('fetch', req('/', { accept: 'text/html' }));
  assert.equal(r.status, 503); assert.doesNotMatch(await r.text(), /PRIVATE OLD ROOT/); assert.match(r.headers.get('cache-control'), /no-store/);
  assert.equal(await w.dispatch('fetch', req('/dashboard', { accept: 'text/html' })), undefined);
});
function backendApp(nodeEnv = 'production') {
  const backendRequire = require('node:module').createRequire(path.join(root, 'backend/package.json'));
  const doubles = {
    express: backendRequire('express'), cors: backendRequire('cors'), helmet: backendRequire('helmet'),
    './config': { config: { nodeEnv, corsAllowedOrigins: ['https://app.example'] } },
    './monitoring/middlewares/metricsMiddleware': { metricsMiddleware: (_q, _r, n) => n() },
    './monitoring/middlewares/loggingMiddleware': { loggingMiddleware: (_q, _r, n) => n() },
    './monitoring/routes/monitoringRoutes': { monitoringRouter: backendRequire('express').Router().get('/health', (_q, r) => r.json({ status: 'healthy fixture' })) },
    './modules/device/device.routes': { deviceRouter: backendRequire('express').Router().post('/fixture', (q, r) => r.json(q.body)) },
    './logging': { LogService: { info() {}, error() {} } },
    './monitoring/telemetry/promTelemetryProvider': { telemetryProvider: { startSpan: () => ({ setAttribute() {}, end() {} }) } },
  };
  if (fs.existsSync(path.join(root, 'backend/src/security/cors.ts'))) doubles['./security/cors'] = load('backend/src/security/cors.ts', { cors: backendRequire('cors') });
  return load('backend/src/app.ts', doubles).app;
}
async function httpFixture(app, run) {
  const http = require('node:http');
  const listener = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { listener.once('listening', resolve); listener.once('error', reject); });
  const port = listener.address().port;
  const send = (p, headers = {}, method = 'GET', body) => new Promise((resolve, reject) => {
    const r = http.request({ hostname: '127.0.0.1', port, path: p, method, headers, timeout: 2000 }, s => { let text = ''; s.on('data', c => text += c); s.on('end', () => resolve({ status: s.statusCode, headers: s.headers, text })); });
    r.once('timeout', () => r.destroy(new Error('fixture deadline'))); r.once('error', reject); if (body) r.write(body); r.end();
  });
  try { await run(send, `http://127.0.0.1:${port}`); } finally { await new Promise(resolve => listener.close(resolve)); }
}
test('backend CORS denies unconfigured browser origins and permits exact configured, same-origin and absent Origin', async () => {
  await httpFixture(backendApp(), async (send, origin) => {
    const denied = await send('/health', { Origin: 'https://evil.example' }); assert.equal(denied.status, 403); assert.equal(denied.headers['access-control-allow-origin'], undefined);
    for (const o of ['https://app.example', origin]) {
      const r = await send('/health', { Origin: o }); assert.equal(r.status, 200); assert.equal(r.headers['access-control-allow-origin'], o); assert.match(r.headers.vary, /Origin/i);
    }
    assert.equal((await send('/health')).status, 200);
    for (const o of ['null', 'https://app.example.evil.test', 'https://app.example/path']) assert.equal((await send('/health', { Origin: o })).status, 403);
    const preflight = await send('/api/fixture', { Origin: 'https://app.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' }, 'OPTIONS'); assert.equal(preflight.status, 204); assert.equal(preflight.headers['access-control-allow-origin'], 'https://app.example');
  });
});
test('backend production excludes telemetry sample routes but health and bounded JSON survive', async () => {
  await httpFixture(backendApp(), async send => {
    for (const p of ['/api/v1/users', '/api/v1/slow-task', '/api/v1/error-demo']) assert.equal((await send(p)).status, 404, p);
    assert.equal((await send('/health')).status, 200);
    assert.equal((await send('/api/fixture', { 'Content-Type': 'application/json' }, 'POST', '{"synthetic":true}')).status, 200);
    assert.equal((await send('/api/fixture', { 'Content-Type': 'application/json' }, 'POST', JSON.stringify({ fixture: 'a'.repeat(103000) }))).status, 413);
  });
  await httpFixture(backendApp('development'), async send => { assert.equal((await send('/api/v1/users')).status, 200); });
});
test('Vercel static and server header defaults have compatible hardening', () => {
  const config = JSON.parse(source('vercel.json'));
  const headers = Object.fromEntries(config.headers.find(r => r.source === '/(.*)').headers.map(h => [h.key.toLowerCase(), h.value]));
  assert.match(headers['content-security-policy'], /base-uri 'self'/); assert.match(headers['content-security-policy'], /object-src 'none'/); assert.doesNotMatch(headers['content-security-policy'], /\*\.vercel\.app/);
  assert.equal(headers['x-content-type-options'], 'nosniff'); assert.match(headers['permissions-policy'], /camera=\(self\)/); assert.equal(headers['x-xss-protection'], '0');
});
test('unknown clinic subroutes and personalized favicon do not inherit public caching', async () => {
  const s = scale();
  for (const p of ['/c/demo/token', '/c/demo/private.js', '/compare/demo/private', '/clinic-software/demo/private']) assert.match(s.edgeCachePolicy(req(p), new URL(req(p).url)).cacheControl, /private.*no-store/, p);
  for (const p of ['/c/demo', '/c/demo/about', '/c/demo/contact', '/c/demo/services', '/compare/demo']) assert.match(s.edgeCachePolicy(req(p), new URL(req(p).url)).cacheControl, /public/, p);
  const r = await server(() => new Response('unused')).fetch(req('/favicon.ico', { cookie: 'session=fixture' }), {}, {});
  assert.match(r.headers.get('cache-control'), /private.*no-store/);
});
test('real container contexts exclude secrets, sessions and git metadata', () => {
  for (const prefix of ['', 'backend/', 'whatsapp-bridge/', 'observability/']) {
    const p = `${prefix}.dockerignore`; assert.ok(fs.existsSync(path.join(root, p)), p);
    const text = source(p);
    for (const pattern of ['**/.env*', '**/.git', '**/node_modules', '**/.wwebjs_auth', '**/auth_info_baileys', '**/sessions', '**/creds.json']) assert.ok(text.split(/\r?\n/).includes(pattern), `${p}: ${pattern}`);
    assert.match(text, /!\*\*\/\.env\.example/);
  }
});
module.exports = { load, source, scale, req };
