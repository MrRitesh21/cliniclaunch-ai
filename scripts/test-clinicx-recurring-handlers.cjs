// Framework registration/DTO tests; mocked verified auth, DB transport and provider. No HTTP/JWT claim.
const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const Module=require('node:module');const {test}=require('node:test');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
test('recurring handlers require verified auth and reject malformed inputs before transports; GETs do not mutate',async()=>{
 const org='00000000-0000-4000-8000-000000000002';const id='00000000-0000-4000-8000-000000000003';const auth={};const original=Module._load;const calls=[];const registrations=[];
 let kind='change';let status='active';let page={kind:'payments',currency:'INR',amount_unit:'paise',entries:[],has_more:false,next_cursor:null};
 const command=()=>({id,organization_id:org,actor_id:'actor',provider_subscription_id:'sub_Safe',kind,state:'reserved',plan_id:'professional',billing_cycle:'yearly',provider_plan_id:kind==='change'?'plan_Target':'plan_Old',previous_provider_plan_id:'plan_Old',amount_paise:8599000,paid_through:'2030-03-17T17:46:40.000Z',reason:kind==='cancel'?'Moving practice':null});
 const rpc=async(name,args)=>{calls.push([name,args]);let data;
  if(name==='clinicx_reserve_recurring'||name==='clinicx_recurring_command_context')data=command();
  else if(name==='clinicx_finish_recurring')data={...command(),state:kind==='change'?'scheduled':'confirmed'};
  else if(name==='clinicx_renewal_context')data={provider_subscription_id:null};
  else if(name==='clinicx_billing_history_page')data=page;
  else if(name==='clinicx_invoice_detail')data={id,organization_id:org,invoice_number:'RZP-pay_Valid',payment_id:'pay_Valid',provider_invoice_id:'inv_Valid',provider_subscription_id:'sub_Safe',amount_paise:299900,currency:'INR',amount_unit:'paise',status:'paid',paid_at:null,period_start:null,period_end:null,provider_plan_id:'plan_Old',plan_id:'growth',billing_cycle:'monthly',authority_version:'clinicx-v1'};
  else data=command();return {data,error:null};};
 const provider={getSubscription:async()=>({id:'sub_Safe',plan_id:'plan_Old',status,quantity:1,payment_method:'card',has_scheduled_changes:false,pause_initiated_by:'self'}),getPlan:async()=>({id:'plan_Target',period:'yearly',interval:1,item:{amount:8599000,currency:'INR'}}),scheduleSubscriptionChange:async()=>({id:'sub_Safe'}),getScheduledSubscriptionChange:async()=>({id:'sub_Safe',plan_id:'plan_Target',status:'active',quantity:1,has_scheduled_changes:true,change_scheduled_at:1900000000}),cancelSubscription:async()=>{status='cancelled';return {id:'sub_Safe'};},resumeSubscription:async()=>{status='active';return {id:'sub_Safe'};}};
 Module._load=function(name,parent,main){
  if(name==='@tanstack/react-start')return {createServerFn:options=>{let validate,middleware;const chain={middleware:m=>{middleware=m;return chain;},inputValidator:v=>{validate=v;return chain;},handler:h=>{registrations.push(options.method);return async args=>{assert.ok(middleware.includes(auth),'verified auth required');return h({...args,data:validate(args.data)});};}};return chain;}};
  if(name==='@/integrations/supabase/auth-middleware')return {requireSupabaseAuth:auth};
  if(name==='@/integrations/supabase/client.server')return {supabaseAdmin:{rpc}};
  if(name==='@/lib/razorpay.server')return provider;
  if(name==='@/lib/billing.server')return require('../src/lib/billing.server.ts');
  return original.apply(this,arguments);
 };
 try{
  const actions=require('../src/lib/razorpay.functions.ts');const context={supabase:{rpc},userId:'actor'};const run=(name,data)=>actions[name]({context,data});
  for(const name of ['changeRazorpaySubscription','cancelRazorpaySubscription','resumeRazorpaySubscription','reconcileRecurringSubscriptionCommand','getSubscriptionRenewalQuote','getSubscriptionInvoice','listSubscriptionBillingPage'])await assert.rejects(run(name,{organization_id:'bad'}));
  assert.equal(calls.length,0);
  assert.equal((await run('changeRazorpaySubscription',{organization_id:org,plan_id:'professional',billing_cycle:'yearly'})).state,'scheduled');
  kind='cancel';assert.equal((await run('cancelRazorpaySubscription',{organization_id:org,reason:'Moving practice'})).reason,'Moving practice');
  kind='resume';status='paused';assert.equal((await run('resumeRazorpaySubscription',{organization_id:org})).requires_new_mandate,false);
  calls.length=0;
  assert.equal((await run('getSubscriptionRenewalQuote',{organization_id:org})).available,false);
  assert.equal((await run('getSubscriptionInvoice',{organization_id:org,invoice_id:id})).amount_paise,299900);
  assert.equal((await run('listSubscriptionBillingPage',{organization_id:org,kind:'payments'})).amount_unit,'paise');
  assert.deepEqual(calls.map(c=>c[0]),['clinicx_renewal_context','clinicx_invoice_detail','clinicx_billing_history_page']);
  page={...page,entries:[{amount_paise:Infinity}]};await assert.rejects(run('listSubscriptionBillingPage',{organization_id:org,kind:'payments'}));
  assert.ok(registrations.includes('GET')&&registrations.includes('POST'));
 }finally{Module._load=original;}
});
