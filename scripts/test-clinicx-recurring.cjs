// Offline production adapter/service tests. No env files or live network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { test } = require('node:test');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, f);
const adapter = require('../src/lib/razorpay.server.ts');
test('scheduled update uses documented PATCH cycle_end; monetary mutation is never replayed', async () => {
  assert.equal(typeof adapter.scheduleSubscriptionChange, 'function', 'safe in-place schedule adapter missing');
  process.env.RAZORPAY_KEY_ID='offline'; process.env.RAZORPAY_KEY_SECRET='offline';
  const before=global.fetch; const calls=[];
  global.fetch=async (url,init)=>{calls.push([url,init]);return Response.json({id:'sub_Safe',plan_id:'plan_Target',has_scheduled_changes:true,change_scheduled_at:1900000000});};
  try {
    await adapter.scheduleSubscriptionChange('sub_Safe','plan_Target');
    assert.equal(calls[0][0],'https://api.razorpay.com/v1/subscriptions/sub_Safe');
    assert.equal(calls[0][1].method,'PATCH');
    assert.deepEqual(JSON.parse(calls[0][1].body),{plan_id:'plan_Target',schedule_change_at:'cycle_end'});
    global.fetch=async()=>{calls.push(['failure']);throw Error('ambiguous');};
    await assert.rejects(adapter.scheduleSubscriptionChange('sub_Safe','plan_Target'),/transport/);
    assert.equal(calls.length,2,'ambiguous PATCH cannot create a second monetary request');
    await assert.rejects(adapter.scheduleSubscriptionChange(' sub_Safe','plan_Target'),/invalid/);
    assert.equal(calls.length,2);
  } finally { global.fetch=before; }
});
const {createBillingService}=require('../src/lib/billing.server.ts');
function fixture() {
  const org='00000000-0000-4000-8000-000000000002';
  const command={id:'00000000-0000-4000-8000-000000000003',organization_id:org,actor_id:'actor',provider_subscription_id:'sub_Safe',kind:'change',state:'reserved',plan_id:'professional',billing_cycle:'yearly',provider_plan_id:'plan_Target',previous_provider_plan_id:'plan_Old',amount_paise:8599000,paid_through:'2030-03-17T17:46:40.000Z',reason:null};
  const calls=[];
  const rpc=async(name,args)=>{calls.push([name,args]);return {data:name==='clinicx_finish_recurring'?{...command,state:command.kind==='change'?'scheduled':'confirmed',effective_at:new Date(1900000000*1000).toISOString()}:command,error:null};};
  const remote={id:'sub_Safe',plan_id:'plan_Old',status:'active',payment_method:'card',quantity:1,has_scheduled_changes:false};
  const provider={getSubscription:async()=>remote,getPlan:async()=>({id:'plan_Target',period:'yearly',interval:1,item:{amount:8599000,currency:'INR'}}),scheduleSubscriptionChange:async()=>{calls.push(['PATCH']);return {...remote};},getScheduledSubscriptionChange:async()=>({...remote,plan_id:'plan_Target',has_scheduled_changes:true,change_scheduled_at:1900000000}),getSubscriptionInvoices:async()=>[]};
  const admin = { rpc };
  const service=createBillingService({rpc},admin,provider);
  return {org,command,calls,remote,provider,admin,service};
}
test('change schedules one existing card mandate, freezes annual quote, never creates replacement or paid grant',async()=>{
  const f=fixture();assert.equal(typeof f.service.change,'function','safe recurring command orchestration missing');
  const r=await f.service.change({organization_id:f.org,plan_id:'professional',billing_cycle:'yearly'});
  assert.equal(r.state,'scheduled');assert.equal(f.calls.filter(c=>c[0]==='PATCH').length,1);
  assert.ok(f.calls.some(c=>c[0]==='clinicx_finish_recurring'));
  assert.equal(f.calls.filter(c=>/checkout|settle_payment/.test(c[0])).length,0);
});
test('cancel stops mandate with canonical cancelled readback and saves optional reason without changing paid time',async()=>{
  const f=fixture();f.command.kind='cancel';f.command.provider_plan_id='plan_Old';f.command.reason='Switching practice';
  f.provider.cancelSubscription=async(id,end)=>{assert.equal(end,false);f.calls.push(['cancel']);f.remote.status='cancelled';return {id,status:'cancelled'};};
  const r=await f.service.cancel(f.org,'Switching practice');
  assert.equal(r.ok,true);assert.equal(f.calls.filter(c=>c[0]==='cancel').length,1);
  const reserve=f.calls.find(c=>c[0]==='clinicx_reserve_recurring');assert.equal(reserve[1].p_reason,'Switching practice');
  assert.ok(f.calls.some(c=>c[0]==='clinicx_finish_recurring'));
});
test('resume only supports merchant-paused state; cancelled mandate never starts new checkout',async()=>{
  const f=fixture();assert.equal(typeof f.service.resume,'function','safe paused resume missing');
  f.command.kind='resume';f.command.provider_plan_id='plan_Old';f.remote.status='cancelled';
  await assert.rejects(f.service.resume(f.org),/paused|cancelled/);
  assert.ok(f.calls.some(c=>c[0]==='clinicx_recurring_command_state'&&c[1].p_state==='aborted'));
  assert.equal(f.calls.filter(c=>/checkout|PATCH|resume-provider/.test(c[0])).length,0);
  f.calls.length=0;f.remote.status='paused';f.remote.pause_initiated_by='self';
  f.provider.resumeSubscription=async(id)=>{f.calls.push(['resume-provider']);f.remote.status='active';return {...f.remote,id};};
  assert.equal((await f.service.resume(f.org)).ok,true);
  assert.equal(f.calls.filter(c=>c[0]==='resume-provider').length,1);
});
test('ambiguous schedule readback marks durable uncertainty and does not confirm command',async()=>{
  const f=fixture();f.provider.getScheduledSubscriptionChange=async()=>({...f.remote,has_scheduled_changes:true,plan_id:'plan_Wrong',change_scheduled_at:1900000000});
  await assert.rejects(f.service.change({organization_id:f.org,plan_id:'professional',billing_cycle:'yearly'}),/readback mismatch/);
  assert.equal(f.calls.filter(c=>c[0]==='PATCH').length,1);
  assert.ok(f.calls.some(c=>c[0]==='clinicx_recurring_command_state'&&c[1].p_state==='uncertain'));
  assert.equal(f.calls.filter(c=>c[0]==='clinicx_finish_recurring').length,0);
});
test('UPI/eMandate, foreign plan and target drift abort before any provider mutation',async()=>{
  for(const mode of ['upi','emandate','wrong-binding','wrong-amount']) {
    const f=fixture();if(['upi','emandate'].includes(mode))f.remote.payment_method=mode;
    if(mode==='wrong-binding')f.remote.plan_id='plan_Foreign';
    if(mode==='wrong-amount')f.provider.getPlan=async()=>({id:'plan_Target',period:'yearly',interval:1,item:{amount:1,currency:'INR'}});
    await assert.rejects(f.service.change({organization_id:f.org,plan_id:'professional',billing_cycle:'yearly'}));
    assert.equal(f.calls.filter(c=>c[0]==='PATCH').length,0);assert.ok(f.calls.some(c=>c[0]==='clinicx_recurring_command_state'&&c[1].p_state==='aborted'));
  }
});
test('changed-plan capture resolves invoice-period quote rather than initial checkout or latest subscription window',async()=>{
  const f=fixture(); const attempt={id:f.command.id,organization_id:f.org,actor_id:'actor',plan_id:'growth',billing_cycle:'monthly',provider_plan_id:'plan_Old',amount_paise:299900,provider_subscription_id:'sub_Safe',state:'settled'};
  const calls=[];const actor={rpc:async()=>({data:attempt,error:null})};
  const admin={rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='clinicx_charge_quote'?{plan_id:'professional',billing_cycle:'yearly',provider_plan_id:'plan_Target',amount_paise:8599000}:name==='clinicx_known_provider_plan'?true:name==='clinicx_recovery_context'?{command:{...f.command,state:'scheduled',effective_at:new Date(1900000000*1000).toISOString()}}:name==='clinicx_stage_recurring_review'?{requires_review:false}:name==='clinicx_recover_and_settle'?{success:true,organization_id:f.org}:name==='clinicx_settle_payment'?{success:true,organization_id:f.org}:{completed:false},error:null};}};
  const provider={...f.provider,verifySubscriptionCheckoutSignature:()=>true,getPayment:async()=>({id:'pay_Capture',status:'captured',amount:8599000,currency:'INR',invoice_id:'inv_Capture'}),getSubscription:async()=>({...f.remote,plan_id:'plan_Target'}),getInvoice:async()=>({id:'inv_Capture',payment_id:'pay_Capture',subscription_id:'sub_Safe',amount:8599000,currency:'INR',status:'paid',billing_start:1900000000,billing_end:1931536000})};
  assert.equal((await createBillingService(actor,admin,provider).activate({subscription_id:'sub_Safe',payment_id:'pay_Capture',signature:'valid'})).success,true);
  const settleCall = calls.find(c=>c[0]==='clinicx_recover_and_settle' || c[0]==='clinicx_settle_payment');
  assert.ok(settleCall, 'expected settlement call');
  assert.equal(settleCall[1].p_evidence.provider_plan_id,'plan_Target');
  assert.equal(settleCall[1].p_evidence.period_start,1900000000);
});
test('renewal quote is provider-plan authority not UI prices, with independent pending-change amount',async()=>{
  const f=fixture();assert.equal(typeof f.service.renewal,'function','authoritative renewal read missing');
  f.remote.charge_at=1900000000;f.remote.plan_id='plan_Old';f.remote.status='active';
  f.provider.getPlan=async id=>({id,period:id==='plan_Old'?'monthly':'yearly',interval:1,item:{amount:id==='plan_Old'?299900:8599000,currency:'INR'}});
  const actor={rpc:async()=>({data:{provider_subscription_id:'sub_Safe',provider_plan_id:'plan_Old',plan_id:'growth',billing_cycle:'monthly',amount_paise:299900,cancel_at_period_end:false,command_state:null,reason:null,pending_change:null},error:null})};
  const svc=createBillingService(actor,actor,f.provider);
  const quote=await svc.renewal(f.org);assert.equal(quote.amount_paise,299900);assert.equal(quote.next_charge_at,1900000000);
  f.provider.getPlan=async id=>({id,period:'monthly',interval:1,item:{amount:1,currency:'INR'}});
  await assert.rejects(svc.renewal(f.org),/quote|plan/);
});
test('uncertain commands reconcile read-only without a second monetary request',async()=>{
  const f=fixture();assert.equal(typeof f.service.reconcileCommand,'function','read-only recurring recovery missing');
  // Simulate provider already applied the change: remote is on target plan, no scheduled changes
  f.remote.plan_id='plan_Target';f.remote.has_scheduled_changes=false;
  f.command.state='uncertain';
  // Need recovery context to return an attempt (not command) that context() can parse
  const originalAdminRpc = f.admin.rpc;
  f.admin.rpc = async (name, args) => {
    if (name === 'clinicx_provider_context') {
      // Return an attempt-like object that context() expects
      return { data: {
        id: f.command.id,
        organization_id: f.org,
        actor_id: 'actor',
        plan_id: 'professional',
        billing_cycle: 'yearly',
        provider_plan_id: 'plan_Target',
        amount_paise: 8599000,
        provider_subscription_id: 'sub_Safe',
        state: 'settled',
      }, error: null };
    }
    if (name === 'clinicx_finish_recurring') {
      return { data: {...f.command, state:'confirmed', effective_at:new Date(1900000000*1000).toISOString()}, error: null };
    }
    if (name === 'clinicx_recovery_context') {
      return { data: { command: null }, error: null };
    }
    return originalAdminRpc(name, args);
  };
  assert.equal((await f.service.reconcileCommand(f.org,f.command.id)).state,'scheduled');
  assert.equal(f.calls.filter(c=>c[0]==='PATCH').length,0);
});
test('every capture resolves a frozen invoice-period quote even when latest mandate returned to original plan',async()=>{
  const f=fixture();const attempt={...f.command,state:'settled',provider_plan_id:'plan_Old',billing_cycle:'monthly',amount_paise:299900};
  const calls=[];const actor={rpc:async()=>({data:attempt,error:null})};
  const admin={rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='clinicx_charge_quote'?{provider_plan_id:'plan_Target',amount_paise:299900,billing_cycle:'monthly'}:name==='clinicx_known_provider_plan'?true:name==='clinicx_recovery_context'?{command:{...f.command,state:'scheduled',effective_at:new Date(1900000000*1000).toISOString()}}:name==='clinicx_settle_payment'?{success:true,organization_id:f.org}:{completed:false},error:null};}};
  const provider={...f.provider,verifySubscriptionCheckoutSignature:()=>true,getPayment:async()=>({id:'pay_Period',status:'captured',amount:299900,currency:'INR',invoice_id:'inv_Period'}),getPlan:async id=>({id,period:'monthly',interval:1,item:{amount:299900,currency:'INR'}}),getInvoice:async()=>({id:'inv_Period',payment_id:'pay_Period',subscription_id:'sub_Safe',amount:299900,currency:'INR',status:'paid',billing_start:1900000000,billing_end:1902592000})};
  await createBillingService(actor,admin,provider).activate({subscription_id:'sub_Safe',payment_id:'pay_Period',signature:'valid'});
  const settleCall = calls.find(c=>c[0]==='clinicx_recover_and_settle' || c[0]==='clinicx_settle_payment');
  assert.ok(settleCall, 'expected settlement call');
  assert.equal(settleCall[1].p_evidence.provider_plan_id,'plan_Target');
});
test('cancellation never treats a generic scheduled-change flag or mismatched committed command as a stopped mandate',async()=>{
 for(const mode of ['active','wrong-command','wrong-state']){
  const f=fixture();f.command.kind='cancel';
  f.provider.cancelSubscription=async()=>{f.remote.status=mode==='active'?'active':'cancelled';f.remote.has_scheduled_changes=true;return f.remote;};
  const rpc=async(name,args)=>{f.calls.push([name,args]);return {data:name==='clinicx_finish_recurring'?{...f.command,state:mode==='wrong-state'?'scheduled':'confirmed',id:mode==='wrong-command'?f.org:f.command.id}:f.command,error:null};};
  await assert.rejects(createBillingService({rpc},{rpc},f.provider).cancel(f.org),/readback|command/i);
 }
});
test('renewal rejects vanished schedule or changed scheduled provider amount',async()=>{
 const f=fixture();f.remote.charge_at=1900000000;
 const current={provider_subscription_id:'sub_Safe',provider_plan_id:'plan_Old',plan_id:'growth',billing_cycle:'monthly',amount_paise:299900,cancel_at_period_end:false,command_state:'scheduled',reason:null,pending_change:{id:f.command.id,plan_id:'professional',billing_cycle:'yearly',provider_plan_id:'plan_Target',amount_paise:8599000,effective_at:new Date(1900000000*1000).toISOString()}};
 f.provider.getPlan=async id=>({id,period:id==='plan_Old'?'monthly':'yearly',interval:1,item:{amount:id==='plan_Old'?299900:8599000,currency:'INR'}});
 const actor={rpc:async()=>({data:current,error:null})};const service=createBillingService(actor,actor,f.provider);
 await assert.rejects(service.renewal(f.org),/schedule/i);
 f.remote.has_scheduled_changes=true;
 assert.equal((await service.renewal(f.org)).pending_change.amount_paise,8599000);
 f.provider.getPlan=async id=>({id,period:id==='plan_Old'?'monthly':'yearly',interval:1,item:{amount:id==='plan_Old'?299900:1,currency:'INR'}});
 await assert.rejects(service.renewal(f.org),/quote.*mismatch/);
});
