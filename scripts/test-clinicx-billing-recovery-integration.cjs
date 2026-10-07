// Real service + real REST adapter + real HTTP job route; only transports doubled.
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),http=require('node:http'),crypto=require('node:crypto'),path=require('node:path');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const [base,org,sid,paidEnd]=process.argv.slice(2);assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
process.env.RAZORPAY_KEY_ID='offline';process.env.RAZORPAY_KEY_SECRET='offline';process.env.CRON_KEY='offline-cron';process.env.SUPABASE_SERVICE_ROLE_KEY='offline';process.env.SUPABASE_URL='http://fixture.invalid';
const realFetch=global.fetch,mutations=[];let remote={id:sid,plan_id:'plan_Growth',status:'active',quantity:1,payment_method:'card',has_scheduled_changes:false,charge_at:Number(paidEnd)};
const start=Math.floor(Date.now()/1000)-3600,end=start+2592000;
let payment={id:'pay_Recovery'+sid.slice(4),status:'authorized',amount:859900,currency:'INR',subscription_id:sid,invoice_id:'inv_Recovery'+sid.slice(4)};
let invoice={id:payment.invoice_id,status:'paid',amount:payment.amount,currency:'INR',payment_id:payment.id,subscription_id:sid,billing_start:start,billing_end:end};
global.fetch=async(url,init={})=>{
 const u=new URL(String(url));if(u.origin===base || u.origin===jobBase)return realFetch(url,init);
 assert.equal(u.origin,'https://api.razorpay.com','all non-fixture network denied');let data;
 if(u.pathname===`/v1/subscriptions/${sid}` && init.method==='PATCH'){
  assert.deepEqual(JSON.parse(init.body),{plan_id:'plan_Pro',schedule_change_at:'cycle_end'});mutations.push('PATCH');remote.has_scheduled_changes=true;data=remote;
 }else if(u.pathname===`/v1/subscriptions/${sid}/retrieve_scheduled_changes`)data={...remote,plan_id:'plan_Pro',change_scheduled_at:Number(paidEnd)};
 else if(u.pathname===`/v1/subscriptions/${sid}/cancel`){mutations.push('cancel');remote={...remote,status:'cancelled'};data=remote;}
 else if(u.pathname===`/v1/subscriptions/${sid}`)data=remote;
 else if(u.pathname===`/v1/payments/${payment.id}`)data=payment;
 else if(u.pathname===`/v1/invoices/${invoice.id}`)data=invoice;
 else if(u.pathname==='/v1/invoices') {assert.equal(u.searchParams.get('subscription_id'),sid);assert.equal(u.searchParams.get('count'),'2');data={entity:'collection',count:1,items:[invoice]};}
 else if(u.pathname==='/v1/plans/plan_Growth')data={id:'plan_Growth',period:'monthly',interval:1,item:{amount:299900,currency:'INR'}};
 else if(u.pathname==='/v1/plans/plan_Pro')data={id:'plan_Pro',period:'monthly',interval:1,item:{amount:859900,currency:'INR'}};
 else throw Error('Provider fixture denied '+u.pathname);
 return Response.json(data);
};
let failFinish=true;const transport=role=>({rpc:async(name,args)=>{
 if(name==='clinicx_finish_recurring' && failFinish){failFinish=false;return {data:null,error:{message:'fixture local confirmation unavailable'}};}
 const response=await realFetch(base,{method:'POST',body:JSON.stringify({name,args,role})});assert.equal(response.status,200);return response.json();
}});
const actor=transport('authenticated'),admin=transport('service_role');
const originalLoad=Module._load;Module._load=function(id,parent,isMain){
 if(id==='@tanstack/react-router')return {createFileRoute:()=>config=>config};
 if(id==='@/integrations/supabase/client.server')return {supabaseAdmin:admin};
 if(id.startsWith('@/lib/'))return originalLoad.call(this,path.resolve(__dirname,'../src/lib',id.slice(6)+'.ts'),parent,isMain);
 return originalLoad.call(this,id,parent,isMain);
};
const provider=require('../src/lib/razorpay.server.ts'),{createBillingService,billingRpc}=require('../src/lib/billing.server.ts'),{handleBillingWebhook}=require('../src/lib/billing-webhook.server.ts');
const {handler}=require('../src/routes/api/internal/clinicx-billing-jobs.ts');let jobBase='';
const server=http.createServer(async(req,res)=>{try{const response=await handler({request:new Request(jobBase+req.url,{method:req.method,headers:req.headers})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());}catch(e){res.writeHead(500);res.end(String(e));}});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));jobBase=`http://127.0.0.1:${server.address().port}`;
 const callJob=(headers={})=>realFetch(jobBase+'/api/internal/clinicx-billing-jobs',{method:'POST',headers});
 assert.equal((await callJob()).status,401);assert.equal((await callJob({'x-cron-key':'bad'})).status,401);assert.deepEqual(mutations,[]);
 delete process.env.RAZORPAY_KEY_SECRET;assert.equal((await callJob({'x-cron-key':'offline-cron'})).status,503);process.env.RAZORPAY_KEY_SECRET='offline';
 const svc=createBillingService(actor,admin,provider);
 const initial=await svc.renewal(org);assert.equal(initial.payment_method,'card');assert.equal(initial.can_change_plan,true);assert.equal(initial.can_resume,false);
 await assert.rejects(svc.change({organization_id:org,plan_id:'professional',billing_cycle:'monthly'}),/confirmation/);
 let c=(await billingRpc(admin,'clinicx_recovery_context',{p_subscription:sid})).command;assert.equal(c.state,'uncertain');assert.equal(c.effective_at,null);
 const travel=await realFetch(base,{method:'POST',body:JSON.stringify({name:'fixture_travel',args:{command:c.id,boundary:start},role:'fixture'})});assert.equal(travel.status,200);
 remote={...remote,plan_id:'plan_Pro',has_scheduled_changes:false,charge_at:end};
 const signature=crypto.createHmac('sha256','offline').update(`${payment.id}|${sid}`).digest('hex');
 assert.equal((await svc.activate({subscription_id:sid,organization_id:org,payment_id:payment.id,signature})).pending,true);
 const first=await callJob({'x-cron-key':'offline-cron'});assert.equal(first.status,200);const firstBody=await first.json();assert.equal(firstBody.result.retry_scheduled,1);assert.equal(firstBody.result.commands_pending,1);
 payment={...payment,status:'captured',captured:true};
 await realFetch(base,{method:'POST',body:JSON.stringify({name:'fixture_due',args:{sid},role:'fixture'})});
 const recovered=await callJob({'x-cron-key':'offline-cron'});assert.equal(recovered.status,200);const recoveredBody=await recovered.json();assert.equal(recoveredBody.result.processed,1);assert.equal(recoveredBody.result.retry_scheduled,0);
 assert.equal((await svc.renewal(org)).plan_id,'professional');
 const event={event:'subscription.charged',payload:{subscription:{entity:{id:sid}},payment:{entity:{id:payment.id}}}};
 for(let n=0;n<2;n++){const response=await handleBillingWebhook(new Request('http://fixture/hook',{method:'POST',headers:{'x-razorpay-event-id':'evt_Duplicate'+sid.slice(4)},body:JSON.stringify(event)}),{admin,provider,verifySignature:()=>true});assert.equal(response.status,200);}
 failFinish=true;await assert.rejects(svc.cancel(org,'Fixture cancel reason'),/confirmation/);
 const cancelEvent={event:'subscription.cancelled',payload:{subscription:{entity:{id:sid}}}};
 assert.equal((await handleBillingWebhook(new Request('http://fixture/hook',{method:'POST',headers:{'x-razorpay-event-id':'evt_Cancel'+sid.slice(4)},body:JSON.stringify(cancelEvent)}),{admin,provider,verifySignature:()=>true})).status,200);
 const cancelled=await svc.renewal(org);assert.equal(cancelled.can_resume,false);assert.equal(cancelled.requires_new_mandate,true);assert.equal(cancelled.will_renew,false);
 assert.deepEqual(mutations,['PATCH','cancel'],'reconciliation never replays provider monetary requests');
 console.log('PASS actual HTTP route unauth/config failure; PATCH success/local confirmation failure; late callback pending/retry/canonical recovery; duplicate webhooks; terminal cancel closes command; truthful capabilities');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
