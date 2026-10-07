// Real source handlers with explicit server/DOM doubles, no app bootstrap/env.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const billing = 'src/routes/_authenticated/dashboard.billing.tsx';
function sourceFunction(file, name, bindings) {
  const text=fs.readFileSync(path.join(root,file),'utf8');
  const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let node; function walk(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)node=n;ts.forEachChild(n,walk);}walk(ast);
  assert.ok(node,`missing actual handler ${name}`);
  const code=ts.transpileModule(node.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function(...Object.keys(bindings),code+`;return ${name};`)(...Object.values(bindings));
}
function bindings() {
  const effects=[]; const workspace={current:{id:'org',role:'owner',epoch:0}};
  return {org:{id:'org'},canManageBilling:true,processing:false,cancelling:false,syncing:false,historyBusy:null,invoiceBusy:false,workspace,
    effects,setProcessing:v=>effects.push(['processing',v]),setCancelling:v=>effects.push(['cancelling',v]),setSyncing:v=>effects.push(['syncing',v]),
    setInvoice:v=>effects.push(['invoice',v]),setInvoiceBusy:v=>effects.push(['invoiceBusy',v]),setCheckoutMessage:v=>effects.push(['message',v]),setShowCancelDialog:v=>effects.push(['cancelDialog',v]),
    toast:Object.fromEntries(['error','success','info'].map(kind=>[kind,message=>effects.push([kind,message])])),refresh:async()=>{},
  };
}
test('cancel response alone cannot declare cancellation: active independent mandate rejects',async()=>{
  const b=bindings();Object.assign(b,{cancelReason:'',cancelFn:async()=>({ok:true,mandate_stopped:true,paid_through:'2030-01-01T00:00:00Z'}),getClinicSubscription:async()=>({organization_id:'org',subscription:{cancel_at_period_end:true,current_period_end:'2030-01-01T00:00:00Z'}}),refreshBilling:async()=>({available:true,provider_status:'active',will_renew:true})});
  await sourceFunction(billing,'confirmCancelPlan',b)();assert.equal(b.effects.some(e=>e[0]==='success'),false);assert.match(b.effects.find(e=>e[0]==='error')[1],/could not be confirmed/);
});
test('cancel retains exact paid-through readback and rejects a mismatching period',async()=>{
  const b=bindings();Object.assign(b,{cancelReason:'',cancelFn:async()=>({ok:true,mandate_stopped:true,paid_through:'2030-01-01T00:00:00Z'}),getClinicSubscription:async()=>({organization_id:'org',subscription:{cancel_at_period_end:true,current_period_end:'2031-01-01T00:00:00Z'}}),refreshBilling:async()=>({available:true,provider_status:'cancelled',will_renew:false})});
  await sourceFunction(billing,'confirmCancelPlan',b)();assert.equal(b.effects.some(e=>e[0]==='success'),false);
});
test('cancel late tenant-switch result cannot refresh or notify the next workspace',async()=>{
  const b=bindings();let refreshes=0;Object.assign(b,{cancelReason:'',refresh:async()=>refreshes++,cancelFn:async()=>{b.workspace.current={id:'other'};return {ok:true};}});
  await sourceFunction(billing,'confirmCancelPlan',b)();assert.equal(refreshes,0);assert.deepEqual(b.effects,[['cancelling',true]]);
});
test('resume only invokes paused lifecycle endpoint, never new checkout',async()=>{
  const b=bindings();let resumes=0;Object.assign(b,{renewal:{available:true,provider_status:'paused'},entitlement:{subscription:{cancel_at_period_end:false}},resumeFn:async()=>{resumes++;return {ok:true,requires_new_mandate:false};},refreshBilling:async()=>({available:true,provider_status:'active',will_renew:true}),startFn:()=>assert.fail('resume must never use checkout')});
  await sourceFunction(billing,'handleResume',b)();assert.equal(resumes,1);assert.equal(b.effects.filter(e=>e[0]==='success').length,1);
});
test('cancelled or customer-paused capability cannot invoke resume',async()=>{
  for(const renewal of [{available:true,provider_status:'cancelled'},{available:true,provider_status:'paused',can_resume:false}]){
    const b=bindings();Object.assign(b,{renewal,entitlement:{subscription:{cancel_at_period_end:false}},resumeFn:()=>assert.fail('unsupported resume')});await sourceFunction(billing,'handleResume',b)();assert.deepEqual(b.effects,[]);
  }
});
test('resume mutation response without active independent readback does not claim success',async()=>{
  const b=bindings();Object.assign(b,{renewal:{available:true,provider_status:'paused'},entitlement:{subscription:{}},resumeFn:async()=>({ok:true,requires_new_mandate:false}),refreshBilling:async()=>({available:true,provider_status:'paused',will_renew:false})});await sourceFunction(billing,'handleResume',b)();assert.equal(b.effects.some(e=>e[0]==='success'),false);
});
test('reconcile passes exact organization/command and never resends financial request',async()=>{
  const b=bindings();let reads=0;Object.assign(b,{commandId:'command-uuid',commandFn:async({data})=>{assert.deepEqual(data,{organization_id:'org',command_id:'command-uuid'});reads++;return {state:'confirmed'};},refreshBilling:async()=>({available:true,will_renew:false}),changeFn:()=>assert.fail('no resend'),cancelFn:()=>assert.fail('no resend'),resumeFn:()=>assert.fail('no resend')});await sourceFunction(billing,'handleReconcileCommand',b)();assert.equal(reads,1);assert.match(b.effects.find(e=>e[0]==='message')[1],/No change, cancel or resume request was resent/);
});
test('invoice preview rejects tenant and invoice ID mismatch before document state',async()=>{
  for(const mismatch of [{organization_id:'other'},{id:'other-invoice'}]){
    const b=bindings();Object.assign(b,{invoiceFn:async()=>({id:'invoice',organization_id:'org',status:'paid',currency:'INR',amount_unit:'paise',authority_version:'clinicx-v1',...mismatch})});await sourceFunction(billing,'previewInvoice',b)('invoice');assert.equal(b.effects.some(e=>e[0]==='invoice'&&e[1]!==null),false);assert.match(b.effects.find(e=>e[0]==='error')[1],/No document was generated/);
  }
});
test('invoice delayed response after workspace switch cannot populate preview',async()=>{
  const b=bindings();Object.assign(b,{invoiceFn:async()=>{b.workspace.current={id:'other'};return {id:'invoice',organization_id:'org'};}});await sourceFunction(billing,'previewInvoice',b)('invoice');assert.deepEqual(b.effects,[['invoice',null],['invoiceBusy',true]]);
});
test('consent does not assume success from mismatching write acknowledgement',async()=>{
  const b=bindings();Object.assign(b,{role:'owner',emailBusy:false,emailDraft:true,consentFn:async()=>({email_enabled:false}),setEmailBusy:v=>b.effects.push(['busy',v]),setEmailError:v=>b.effects.push(['error',v]),setEmailConfirmed:v=>b.effects.push(['confirmed',v])});await sourceFunction('src/components/app/NotificationSettingsCard.tsx','saveEmailConsent',b)();assert.equal(b.effects.some(e=>e[0]==='confirmed'),false);assert.match(b.effects.filter(e=>e[0]==='error').at(-1)[1],/No consent has been assumed/);
});
test('consent never writes for admin or assumes a late owner result in another tenant',async()=>{
  const b=bindings();Object.assign(b,{role:'admin',emailBusy:false,emailDraft:true,consentFn:()=>assert.fail('owner required')});await sourceFunction('src/components/app/NotificationSettingsCard.tsx','saveEmailConsent',b)();assert.deepEqual(b.effects,[]);
  Object.assign(b,{role:'owner',consentFn:async()=>{b.workspace.current={id:'other'};return {email_enabled:true};},setEmailBusy:v=>b.effects.push(['busy',v]),setEmailError:v=>b.effects.push(['error',v]),setEmailConfirmed:()=>assert.fail('stale consent')});await sourceFunction('src/components/app/NotificationSettingsCard.tsx','saveEmailConsent',b)();assert.deepEqual(b.effects,[['busy',true],['error',null]]);
});
test('checkout callback is ignored after A→B→A because workspace generation changed',async()=>{
  const b=bindings();let options,activations=0;Object.assign(b,{paidMandate:false,recurringBlocked:false,pendingPlan:{id:'growth',name:'Growth'},entitlement:{},cycle:'monthly',setPendingPlan:()=>{},z:require('zod').z,downgradeFn:async()=>({allowed:true,violations:[]}),startFn:async()=>({attempt_id:'attempt',subscription_id:'sub_fixture',key_id:'fixture'}),loadRazorpayScript:async()=>true,window:{Razorpay:class{constructor(o){options=o;}open(){}on(){}}},activateFn:async()=>{activations++;return {success:true};}});
  await sourceFunction(billing,'confirmUpgrade',b)();b.workspace.current={id:'other',epoch:1};b.workspace.current={id:'org',epoch:2};const before=b.effects.length;await options.handler({razorpay_payment_id:'pay_fixture',razorpay_subscription_id:'sub_fixture',razorpay_signature:'a'.repeat(64)});assert.equal(activations,0);assert.equal(b.effects.length,before);
});

test('unknown or wrong-tenant trial engagement cannot show all-time amounts as trial totals',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const primitive=tag=>({children,variant,size,...props})=>React.createElement(tag,props,children);
  const text=fs.readFileSync(path.join(root,'src/components/billing/ClinicTrialJourney.tsx'),'utf8');
  const helpers=fs.readFileSync(path.join(root,'src/components/billing/clinicx-ux.ts'),'utf8');
  function load(code,doubles){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText)(id=>doubles[id]??require(id),m,m.exports);return m.exports;}
  const doubles={'@tanstack/react-query':{useQuery:()=>({isError:true})},'@tanstack/react-router':{Link:primitive('a')},'@/components/ui/card':{Card:primitive('section')},'@/components/ui/button':{Button:primitive('button')},'@/components/ui/badge':{Badge:primitive('span')},'@/lib/trial-engagement.functions':{getClinicTrialEngagement:()=>assert.fail('SSR query')},'@/lib/trial-engagement':{trialCheckpoint:()=>null},'./clinicx-ux':load(helpers,{})};
  const {ClinicTrialJourney}=load(text,doubles);
  const snapshot={organization_id:'org',effective_state:'trialing',server_now:'2026-10-22T00:00:00Z',subscription:{trial_started_at:'2026-10-01T00:00:00Z',trial_ends_at:'2026-10-31T00:00:00Z'},usage:{patients:1000,doctors:1,staff:1,appointments:1000,prescriptions:500,invoiced_inr:99999}};
  for(const engagement of [undefined,{organization_id:'other',usage:{invoiced_inr:99999}}]){const html=renderToStaticMarkup(React.createElement(ClinicTrialJourney,{snapshot,engagement}));assert.match(html,/could not be loaded/);assert.doesNotMatch(html,/99,999|Trial-window activity/);}
});
