// Offline pure policy tests; imports transpiled TS, no app/env/provider bootstrap.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = (module, file) => {
  const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  module._compile(result.outputText, file);
};
const policyPath = path.join(root, 'src/lib/subscription-policy.ts');
const serverPath = path.join(root, 'src/lib/subscription.server.ts');
test('server subscription API uses caller-token atomic RPC and fails closed on persistence errors', async () => {
  assert.ok(fs.existsSync(serverPath), 'subscription server API is missing');
  const { provisionTrial, getSubscription } = require(serverPath);
  const calls = [];
  const transport = { rpc: async (name,args) => { calls.push({name,args}); return {data: {organization_id:'org',clinic_id:'clinic'},error:null}; } };
  assert.deepEqual(await provisionTrial(transport, {slug:'synthetic',name:'Clinic',doctorName:'Doctor',businessType:'clinic'}), {organization_id:'org',clinic_id:'clinic'});
  assert.equal(calls[0].name,'clinicx_provision_trial');
  assert.ok(!('p_owner' in calls[0].args), 'actor must come from verified JWT, not an input');
  const failed = {rpc:async()=>({data:null,error:{message:'denied',code:'42501'}})};
  await assert.rejects(provisionTrial(failed,{slug:'synthetic',name:'Clinic',doctorName:'Doctor',businessType:'clinic'}),/denied/);
  await assert.rejects(getSubscription(failed,'org'),/denied/);
  await assert.rejects(getSubscription({rpc:async()=>({data:null,error:null})},'org'),/Missing/);
});

test('entitlement aliases, reception signing RBAC, unlimited and unknown limits fail closed', () => {
  const { canAccess, getLimit } = require(policyPath);
  assert.equal(typeof canAccess,'function','central access evaluator missing');
  const view = {can_read:true,can_write:true,role:'staff',features:['patients','prescriptions','billing'],limits:{patients:100,staff:null}};
  assert.equal(canAccess(view,'records'),true);
  assert.equal(canAccess(view,'finance'),true);
  assert.equal(canAccess(view,'prescriptions'),false,'staff cannot sign prescriptions');
  assert.equal(canAccess({...view,role:'doctor'},'prescriptions'),true);
  assert.equal(canAccess({...view,can_write:false},'patients'),false);
  assert.equal(canAccess({...view,can_write:false},'prescriptions','read'),true);
  assert.equal(canAccess({...view,can_read:false},'patients','read'),false);
  assert.equal(canAccess({...view,role:'doctor',features:['staff_management']},'staff_management'),false,'doctor cannot administer membership/invites');
  assert.equal(canAccess({...view,role:'owner',features:['staff_management']},'staff_management'),true);
  assert.equal(canAccess(view,'made_up'),false);
  assert.equal(getLimit(view,'staff'),null);
  assert.equal(getLimit(view,'patients'),100);
  assert.throws(()=>getLimit(view,'made_up'),/Unknown/);
});

test('TanStack trial action registers auth + validator and forwards caller-token transport', async () => {
  const functionsPath = path.join(root,'src/lib/subscription.functions.ts');
  assert.ok(fs.existsSync(functionsPath),'authenticated subscription actions missing');
  const Module = require('node:module');
  const load = Module._load;
  const authSentinel = {};
  Module._load = function(id,parent,isMain) {
    if(id === '@tanstack/react-start') return {createServerFn:()=>{
      let auth=false,validate;
      const chain={middleware(ms){auth=ms.includes(authSentinel);return chain},inputValidator(v){validate=v;return chain},handler(fn){
        return async ({data,context})=>{assert.equal(auth,true);assert.ok(validate);return fn({data:validate(data),context})};
      }}; return chain;
    }};
    if(id.includes('supabase/auth-middleware')) return {requireSupabaseAuth:authSentinel};
    return load.apply(this,arguments);
  };
  let actions;
  try { actions=require(functionsPath); } finally { Module._load=load; }
  const calls=[];
  const context={userId:'actor',supabase:{rpc:async(name,args)=>{calls.push({name,args});return {data:{organization_id:'org',clinic_id:'clinic'},error:null}}}};
  const result=await actions.provisionClinicTrial({data:{slug:'test-clinic',name:'Clinic',doctorName:'Doctor',businessType:'clinic'},context});
  assert.equal(result.organization_id,'org');
  assert.equal(calls[0].name,'clinicx_provision_trial');
  await assert.rejects(actions.provisionClinicTrial({data:{slug:'!!!',name:'Clinic',doctorName:'Doctor',businessType:'clinic'},context}));
  assert.equal(typeof actions.getClinicSubscription,'function','subscription snapshot action missing');
  assert.equal(typeof actions.exportClinicDataPage,'function','permissioned post-grace export action missing');
  const badContext={userId:'actor',supabase:{rpc:async()=>{throw new Error('must not call')}}};
  await assert.rejects(actions.getClinicSubscription({data:{organizationId:'not-a-uuid'},context:badContext}));
  await assert.rejects(actions.exportClinicDataPage({data:{organizationId:'00000000-0000-4000-8000-000000000000',table:'subscriptions',limit:100},context:badContext}));
  assert.equal(calls.length,1,'invalid profile must not hit RPC');
});

if (process.env.CLINICX_SUBSCRIPTION_CAPTURE) {
  test('real PostgreSQL snapshot/export payloads traverse server wrappers and authenticated actions', async () => {
    const captured=JSON.parse(fs.readFileSync(process.env.CLINICX_SUBSCRIPTION_CAPTURE,'utf8'));
    const {getSubscription,exportClinicData}=require(serverPath);
    const actions=require(path.join(root,'src/lib/subscription.functions.ts'));
    const transport={rpc:async(name,args)=>{
      assert.equal(args.p_org,captured.snapshot.organization_id);
      return {data:name==='clinicx_subscription_snapshot'?captured.snapshot:captured.export,error:null};
    }};
    const snapshot=await getSubscription(transport,captured.snapshot.organization_id);
    assert.equal(snapshot.usage.patients,1);
    assert.equal(snapshot.role,'owner');
    const context={userId:'verified-mocked-user',supabase:transport};
    assert.deepEqual(await actions.getClinicSubscription({data:{organizationId:snapshot.organization_id},context}),snapshot);
    const request={organizationId:snapshot.organization_id,table:'patients',cursor:null,limit:100};
    assert.deepEqual(await actions.exportClinicDataPage({data:request,context}),await exportClinicData(transport,request));
    await assert.rejects(getSubscription({rpc:async()=>({data:captured.snapshot,error:null})},'wrong-org'),/mismatch/);
    await assert.rejects(exportClinicData({rpc:async()=>({data:null,error:{message:'permission denied'}})},request),/permission denied/);
  });
}

test('export transport rejects non-JSON nested values and preserves JSON backups', async () => {
  const {exportClinicData}=require(serverPath);
  const request={organizationId:'org',table:'patients'};
  const response=records=>({rpc:async()=>({data:{records,next_cursor:null,has_more:false,table:'patients'},error:null})});
  const records=[{id:'synthetic',nested:{array:[1,true,null,{label:'hello'}]}}];
  assert.deepEqual((await exportClinicData(response(records),request)).records,records);
  for(const value of [undefined,()=>{},Symbol('bad'),BigInt(1),new Date(),Infinity,NaN]) {
    await assert.rejects(exportClinicData(response([{id:'synthetic',nested:{value}}]),request),undefined,'non-JSON payload must fail closed');
  }
});

test('UTC trial and grace boundaries are exact, never dependent on persisted trialing status', () => {
  assert.ok(fs.existsSync(policyPath), 'central subscription policy is missing');
  const { effectiveState } = require(policyPath);
  const sub = { status: 'trialing', access_source: 'free_trial', trial_ends_at: '2026-11-06T12:00:00Z', grace_ends_at: '2026-11-13T12:00:00Z', current_period_end: null };
  assert.equal(effectiveState(sub, '2026-11-06T11:59:59.999Z'), 'trialing');
  assert.equal(effectiveState(sub, '2026-11-06T12:00:00Z'), 'grace_period');
  assert.equal(effectiveState(sub, '2026-11-13T11:59:59.999Z'), 'grace_period');
  assert.equal(effectiveState(sub, '2026-11-13T12:00:00Z'), 'suspended');
  assert.equal(effectiveState({ ...sub, status: 'suspended' }, '2026-10-07T12:00:00Z'), 'suspended');
});
