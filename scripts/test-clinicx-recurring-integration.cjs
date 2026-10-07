// Only invoked by isolated PostgreSQL fixture. Real service + REST adapter; provider transport mocked.
const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const [base,org,sid,paidEnd,invoiceId]=process.argv.slice(2);
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base||''))throw Error('Isolated loopback fixture bridge required');
process.env.RAZORPAY_KEY_ID='offline';process.env.RAZORPAY_KEY_SECRET='offline';
const realFetch=global.fetch;const mutations=[];
let scheduled=null;let remote={id:sid,plan_id:'plan_Growth',status:'active',quantity:1,payment_method:'card',has_scheduled_changes:false,charge_at:Number(paidEnd)};
global.fetch=async(url,init={})=>{
 if(String(url)===base)return realFetch(url,init);
 const u=new URL(String(url));assert.equal(u.origin,'https://api.razorpay.com','all non-fixture network denied');
 let data;
 if(u.pathname===`/v1/subscriptions/${sid}`&&init.method==='PATCH'){
  const body=JSON.parse(init.body);assert.deepEqual(body,{plan_id:'plan_ProAnnual',schedule_change_at:'cycle_end'});mutations.push('schedule');
  remote.has_scheduled_changes=true;scheduled={...remote,plan_id:body.plan_id,change_scheduled_at:Number(paidEnd)};data=remote;
 }else if(u.pathname===`/v1/subscriptions/${sid}/retrieve_scheduled_changes`)data=scheduled;
 else if(u.pathname===`/v1/subscriptions/${sid}/cancel`){
  assert.equal(JSON.parse(init.body).cancel_at_cycle_end,0);mutations.push('cancel');remote={...remote,status:'cancelled',has_scheduled_changes:false};data=remote;
 }else if(u.pathname===`/v1/subscriptions/${sid}`)data=remote;
 else if(u.pathname==='/v1/plans/plan_Growth')data={id:'plan_Growth',period:'monthly',interval:1,item:{amount:299900,currency:'INR'}};
 else if(u.pathname==='/v1/plans/plan_ProAnnual')data={id:'plan_ProAnnual',period:'yearly',interval:1,item:{amount:8599000,currency:'INR'}};
 else throw Error('Provider fixture route denied: '+u.pathname);
 return Response.json(data);
};
const transport=role=>({rpc:async(name,args)=>{const response=await global.fetch(base,{method:'POST',body:JSON.stringify({name,args,role})});assert.equal(response.status,200);return response.json();}});
const actor=transport('authenticated');const admin=transport('service_role');
const provider=require('../src/lib/razorpay.server.ts');const {createBillingService,billingRpc}=require('../src/lib/billing.server.ts');
(async()=>{
 const svc=createBillingService(actor,admin,provider);
 const command=await svc.change({organization_id:org,plan_id:'professional',billing_cycle:'yearly'});
 assert.equal(command.state,'scheduled');assert.equal(command.amount_paise,8599000);
 const renewal=await svc.renewal(org);assert.equal(renewal.amount_paise,299900);assert.equal(renewal.pending_change.amount_paise,8599000);
 await assert.rejects(svc.change({organization_id:org,plan_id:'professional',billing_cycle:'yearly'}),/pending/);
 const detail=await billingRpc(actor,'clinicx_invoice_detail',{p_org:org,p_invoice:invoiceId});assert.equal(detail.amount_paise,299900);assert.ok(detail.period_start);
 const page=await billingRpc(actor,'clinicx_billing_history_page',{p_org:org,p_kind:'payments',p_limit:1});assert.equal(page.entries.length,1);assert.equal(page.has_more,false);
 const cancellation=await svc.cancel(org,'Local fixture reason');assert.equal(cancellation.mandate_stopped,true);
 const current=await billingRpc(actor,'clinicx_billing_current',{p_org:org});assert.equal(current.active,true);
 assert.equal((await svc.renewal(org)).will_renew,false);
 await assert.rejects(svc.start({organization_id:org,plan_id:'growth',billing_cycle:'monthly'}),/paid-through/);
 await assert.rejects(svc.resume(org),/cancelled/);
 assert.deepEqual(mutations,['schedule','cancel'],'one in-place update and one definitive stop; no new mandate or automatic replay');
 console.log('PASS: real service/REST adapter -> isolated PostgreSQL schedule, provider renewal, canonical invoice/page, cancellation, paid-through and unsafe replacement/resume denial');
})().catch(error=>{console.error(error);process.exitCode=1;});
