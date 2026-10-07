// Offline tests: transpile actual modules, never resolve production clients/env.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(relative, overrides = {}, environment = {}, globals = {}) {
  const file = path.join(root, relative);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const mod = {exports: {}};
  vm.runInNewContext(code, {module: mod, exports: mod.exports, Request, Response, AbortSignal, AbortController,
    setTimeout, clearTimeout, ...globals, console, process: {env: environment}, fetch: () => {throw Error('Network disabled');},
    require: name => {
      if (name in overrides) return overrides[name];
      if (name.startsWith('./trial-engagement')) return load('src/lib/' + name.slice(2) + '.ts', overrides, environment);
      return require(name);
    },
  }, {filename: file});
  return mod.exports;
}
const worker = load('src/lib/trial-engagement.server.ts');
const tests = [];
function test(name, fn) {tests.push({name, fn});}
test('VITE-only cron key rejected before admin import', async () => {
  let adminImports = 0;
  const route = load('src/routes/api/internal/clinicx-jobs.ts', {
    '@tanstack/react-router': {createFileRoute: () => config => config},
    '@/lib/trial-engagement.server': worker,
    '@/integrations/supabase/client.server': {get supabaseAdmin() {adminImports++; throw Error('No admin client permitted');}},
  }, {VITE_CRON_KEY: 'public-fixture', SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture'});
  const response = await route.Route.server.handlers.POST({request: new Request('https://fixture.invalid/api/internal/clinicx-jobs', {headers: {'x-cron-key':'public-fixture'}})});
  assert.equal(response.status, 401);
  assert.equal(adminImports, 0);
});
const job = n => ({id: `11111111-1111-4111-8111-${String(n).padStart(12,'0')}`, lease_token: '22222222-2222-4222-8222-222222222222', idempotency_key: 'fixture-'+n, to: 'owner@example.invalid', copy: {title:'No PHI',body:'No PHI'}});
for (const change of ['consent', 'membership', 'paid activation', 'email']) test('per-send preflight after '+change, async () => {
  let eligible = true, sent = 0, preflights = 0, finished = 0;
  const db = {rpc: async name => {
    let data;
    if (name === 'expire_lapsed_subscriptions' || name === 'clinicx_prepare_notification_delivery') data = 0;
    else if (name === 'clinicx_claim_notification_delivery') data = [job(1),job(2)];
    else if (name === 'clinicx_preflight_notification_delivery') {preflights++; data = eligible ? 'send' : 'suppressed';}
    else if (name === 'clinicx_finish_notification_delivery') {finished++; data = true;}
    else throw Error('Unexpected RPC '+name);
    return {data,error:null};
  }};
  const result = await worker.runTrialEngagementJobs(db, {sendEmail: async () => {sent++; eligible=false;}});
  assert.equal(sent,1); assert.equal(preflights,2); assert.equal(finished,1); assert.equal(result.suppressed,1);
});
test('lost preflight fence sends nothing', async () => {
  let sent=0;
  const db={rpc: async name => ({data:name==='clinicx_claim_notification_delivery'?[job(1)]:name==='clinicx_preflight_notification_delivery'?'lease_lost':0,error:null})};
  await assert.rejects(worker.runTrialEngagementJobs(db,{sendEmail:async()=>{sent++;}}), /reconciliation/);
  assert.equal(sent,0);
});
test('independent owner consent GET is authenticated and tenant-bound', async () => {
  const auth = {};
  const factory = {
    createServerFn: ({method}) => ({middleware(m) {assert.equal(m[0],auth); return this;}, inputValidator(fn) {this.validate=fn;return this;}, handler(fn) {return {method,validate:this.validate,handler:fn};}}),
  };
  const functions=load('src/lib/trial-engagement.functions.ts', {'@tanstack/react-start':factory,'../integrations/supabase/auth-middleware':{requireSupabaseAuth:auth}});
  const get=functions.getClinicTrialEmailConsent;
  assert.ok(get,'Independent GET missing'); assert.equal(get.method,'GET');
  assert.throws(()=>get.validate({organizationId:'not-uuid'}));
  const org='33333333-3333-4333-8333-333333333333'; const user='44444444-4444-4444-8444-444444444444';
  const context={supabase:{rpc:async(name,args)=>{assert.equal(name,'clinicx_get_engagement_email');assert.equal(args.p_org,org);return {data:{organization_id:org,user_id:user,email_enabled:false,updated_at:null},error:null};}}};
  const result=await get.handler({data:get.validate({organizationId:org}),context}); assert.equal(result.email_enabled,false);
  context.supabase.rpc=async()=>({data:{...result,organization_id:user},error:null});
  await assert.rejects(get.handler({data:{organizationId:org},context}), /Tenant response mismatch/);
});
test('provider response body has finite deadline', async () => {
  let signal;
  const timedWorker=load('src/lib/trial-engagement.server.ts', {}, {}, {setTimeout: fn=>setTimeout(fn,10)});
  const send=timedWorker.createTrialEmailSender('fixture-key',async(_url,options)=>{signal=options.signal;return {ok:true,json:()=>new Promise(()=>{})};});
  const outcome=await Promise.race([send(job(1)).then(()=> 'resolved',()=> 'rejected'),new Promise(r=>setTimeout(()=>r('hung'),100))]);
  assert.equal(outcome,'rejected'); assert.equal(signal.aborted,true);
});
(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    if (process.env.CLINICX_SAFETY_CASE && !t.name.includes(process.env.CLINICX_SAFETY_CASE)) continue;
    try {await t.fn(); passed++; console.log('PASS:', t.name);} catch (e) {failed++; console.error('FAIL:',t.name,e);}
  }
  console.log(JSON.stringify({passed,failed})); process.exitCode = failed ? 1 : 0;
})();
