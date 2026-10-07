// Fresh isolated browser: real ClinicX components; explicit offline transports.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { rolldown } from 'rolldown';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const scratch = process.env.CLINICX_FRONTEND_SCRATCH;
if (!scratch) throw new Error('Set CLINICX_FRONTEND_SCRATCH to approved profile scratch');
await fs.mkdir(scratch, { recursive: true });
const orgId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const commandId = '33333333-3333-4333-8333-333333333333';
const invoiceId = '44444444-4444-4444-8444-444444444444';
const plans = ['starter','growth','professional','enterprise'].map((id,i) => ({ id, name: ['Starter','Growth','Professional','Enterprise'][i], monthly_price: [999,2999,8599,19999][i], yearly_price: [9990,29990,85990,199990][i], is_popular: id === 'growth', tagline: 'Synthetic catalog fixture' }));
const snapshot = {
  organization_id: orgId, role: 'owner', server_now: '2026-10-22T00:00:00Z', effective_state: 'active', can_read: true, can_write: true, can_export: true,
  configuration_requires_reconciliation: false,
  subscription: { id: 'fixture-subscription', access_source: 'verified_payment', billing_cycle: 'monthly', plan_id: 'growth', trial_started_at: '2026-10-01T00:00:00Z', trial_ends_at: '2026-10-31T00:00:00Z', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false },
  usage: { patients: 32, appointments: 47, completed_appointments: 19, visits: 12, prescriptions: 9, invoices: 3, doctors: 1, staff: 0, pending_staff_invites: 0, invoiced_inr: 24500, collected_inr: 12000, features_used: [], window: 'all_time' },
  limits: { patients: null, staff: null, doctors: null }, recommendation: { plan_id: 'growth' },
};
const engagement = { organization_id: orgId, server_now: snapshot.server_now, activation: [], checkpoints: [], usage: { window: 'trial', window_started_at: snapshot.subscription.trial_started_at, window_ended_at: snapshot.server_now, currency: 'INR', patients: 7, appointments: 9, completed_appointments: 4, visits: 3, completed_visits: null, prescriptions: 2, invoices: 1, invoiced_inr: 1250, collected_inr: 500, days_active: 3, days_active_basis: 'Recorded UTC activity', completed_visits_unavailable_reason: 'EMR does not track completion' } };
const quote = { available: true, currency: 'INR', amount_unit: 'paise', provider_status: 'active', plan_id: 'growth', billing_cycle: 'monthly', will_renew: true, amount_paise: 299900, recurring_amount_paise: 299900, next_charge_at: 1893456000, pending_change: null, reason: null };
const transportModule = `
import React from 'react';
export const state = window.fixtureState = { orgId: ${JSON.stringify(orgId)}, snapshot: ${JSON.stringify(snapshot)}, engagement: ${JSON.stringify(engagement)}, quote: ${JSON.stringify(quote)}, mode: 'normal', calls: [], toasts: [], consent: false, role: 'owner' };
export function invoke(name) { return async ({data}) => {
  state.calls.push({name,data});
  if (state.defer === name) { await new Promise(resolve => state.release = resolve); }
  if (name === 'getClinicSubscription') return state.snapshot;
  if (name === 'getClinicTrialEngagement') return state.engagement;
  if (name === 'getSubscriptionRenewalQuote') return state.quote;
  if (name === 'listBillingReminders') return [];
  if (name === 'checkSubscriptionDowngrade') return { allowed: true, violations: [] };
  if (name === 'changeRazorpaySubscription') {
    if (state.mode === 'unsupported') throw new Error('UPI/eMandate changes cannot be scheduled in place');
    const command = { id: '${commandId}', organization_id: data.organization_id, state: 'scheduled', plan_id: data.plan_id, billing_cycle: data.billing_cycle, amount_paise: data.billing_cycle === 'yearly' ? 8599000 : 859900, effective_at: '2030-01-01T00:00:00Z' };
    if (state.mode !== 'missing-readback') state.quote = { ...state.quote, pending_change: command };
    return command;
  }
  if (name === 'cancelRazorpaySubscription') {
    state.quote = {...state.quote, provider_status:'cancelled', will_renew:false, amount_paise:null, next_charge_at:null, pending_change:null};
    state.snapshot = {...state.snapshot, subscription:{...state.snapshot.subscription, cancel_at_period_end:true}};
    return {ok:true, mandate_stopped:true, paid_through:state.snapshot.subscription.current_period_end};
  }
  if (name === 'resumeRazorpaySubscription') {
    state.quote = {...state.quote, provider_status:'active', will_renew:true};
    return {ok:true, requires_new_mandate:false};
  }
  if (name === 'reconcileRecurringSubscriptionCommand') return {state:'confirmed'};
  if (name === 'listSubscriptionBillingPage') {
    const id = data.cursor ? '00000000-0000-4000-8000-000000000001' : '${invoiceId}';
    const entries = data.kind === 'legacy_invoices' ? [] : [{id,invoice_number:data.cursor?'CX-OLDER':'CX-VERIFIED',payment_id:data.cursor?'pay_older':'pay_current',amount_paise:299900,status:'paid',created_at:'2026-10-01T00:00:00Z'}];
    return {kind:data.kind,currency:'INR',amount_unit:data.kind==='legacy_invoices'?'unclassified':'paise',entries,has_more:!data.cursor && entries.length>0,next_cursor:!data.cursor && entries.length?{id,created_at:'2026-10-01T00:00:00Z'}:null};
  }
  if (name === 'getSubscriptionInvoice') return {id:data.invoice_id,organization_id:state.mode==='wrong-invoice'?'${otherId}':data.organization_id,invoice_number:'CX-VERIFIED',amount_paise:299900,currency:'INR',amount_unit:'paise',status:'paid',authority_version:'clinicx-v1',payment_id:'pay_current',period_start:null,period_end:null,plan_id:'growth',billing_cycle:'monthly'};
  if (name === 'setClinicTrialEmailConsent') {state.consent=data.enabled; return {email_enabled:state.mode==='wrong-consent'?!data.enabled:data.enabled};}
  if (name === 'startRazorpaySubscription') return {key_id:'isolated-key',subscription_id:'sub_fixture',attempt_id:'${commandId}'};
  if (name === 'activateRazorpaySubscription') return {success:false,pending:true};
  if (name === 'exportClinicDataPage') return {table:data.table,records:[],has_more:false,next_cursor:null};
  return {ok:true};
}; }
export function useOrganization() { return {org:{id:state.orgId},role:state.role,entitlement:state.snapshot,authorityError:null,isSubscriptionExpired:false,refresh:async()=>window.rerender()}; }
export const supabase={from(table) { const rows = table==='plans'?${JSON.stringify(plans)}:table==='plan_limits'?${JSON.stringify(plans.flatMap(p => ['patients','staff','doctors'].map(limit_name => ({plan_id:p.id,limit_name,limit_value:null}))))}:[]; const chain={select:()=>chain,order:()=>chain,then:resolve=>Promise.resolve({data:rows,error:null}).then(resolve)};return chain; }};
`;
const fnNames = ['startRazorpaySubscription','cancelRazorpaySubscription','resumeRazorpaySubscription','changeRazorpaySubscription','reconcileRecurringSubscriptionCommand','getSubscriptionRenewalQuote','listSubscriptionBillingPage','getSubscriptionInvoice','checkSubscriptionDowngrade','activateRazorpaySubscription','syncRazorpaySubscription','listBillingReminders','dismissBillingReminder','getClinicSubscription','exportClinicDataPage','getClinicTrialEngagement','setClinicTrialEmailConsent'];
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';
import {Route} from './src/routes/_authenticated/dashboard.billing';
import {ClinicTrialJourney} from './src/components/billing/ClinicTrialJourney';
import {NotificationSettingsCard} from './src/components/app/NotificationSettingsCard';
import {state} from 'virtual:transports';
const root=createRoot(document.getElementById('root')); const Billing=Route.component;
window.Razorpay=class {constructor(options){window.checkoutOptions=options;} open(){state.calls.push({name:'checkout-open'});} on(){}};
window.rerender=()=>root.render(<React.Fragment key={state.remount||0}><Billing/><NotificationSettingsCard/><div id='checklist'><ClinicTrialJourney snapshot={{...state.snapshot,effective_state:'trialing'}} clinic={{clinic_name:'Clinic',doctor_name:'Doctor',specialization:'GP'}} checklist /></div></React.Fragment>);window.rerender();
`;
const bundle = await rolldown({cwd:root,input:'virtual:entry',platform:'browser',plugins:[{
  name:'explicit-offline-boundaries',resolveId(id, importer) {
    if (id==='virtual:entry') return path.join(root,'isolated-clinicx.tsx');
    if (id==='virtual:transports') return '\0transports.jsx';
    if (id==='./dashboard' && importer?.endsWith('dashboard.billing.tsx')) return '\0clinic.jsx';
    if (id==='@tanstack/react-router') return '\0router.jsx';
    if (id==='@tanstack/react-start') return '\0start.js';
    if (id==='@tanstack/react-query') return '\0query.jsx';
    if (id==='sonner') return '\0toast.js';
    if (id==='@/hooks/useOrganization'||id==='@/integrations/supabase/client') return '\0transports.jsx';
    if (/^@\/lib\/(razorpay|subscription|trial-engagement)\.functions$/.test(id)) return '\0functions.js';
    if (id==='@/lib/push-client') return '\0push.js';
    if (/^@\/components\/ui\//.test(id)) return '\0ui.jsx';
    if (id.startsWith('@/components/billing/') || id==='@/lib/trial-engagement') return path.join(root,'src',id.slice(2)) + (id.endsWith('clinicx-ux') || id.endsWith('trial-engagement') ? '.ts' : '.tsx');
    if (id.startsWith('@/')) throw new Error('Undoubled app boundary: '+id);
  },load(id) {
    if(id===path.join(root,'isolated-clinicx.tsx')) return entry;
    if(id==='\0transports.jsx') return transportModule;
    if(id==='\0functions.js') return `import {invoke} from 'virtual:transports';${fnNames.map(n=>`export const ${n}=invoke('${n}');`).join('\n')}`;
    if(id==='\0start.js') return 'export const useServerFn=f=>f;';
    if(id==='\0clinic.jsx') return `export const useClinic=()=>({clinic_name:'Clinic',doctor_name:'Doctor',specialization:'GP'});`;
    if(id==='\0router.jsx') return `import React from 'react';export const createFileRoute=()=>options=>options;export const Link=({to,children,...props})=><a href={to} {...props}>{children}</a>;`;
    if(id==='\0toast.js') return `import {state} from 'virtual:transports';export const toast=Object.fromEntries(['success','error','info'].map(kind=>[kind,message=>state.toasts.push({kind,message})]));`;
    if(id==='\0push.js') return 'export const usePushNotifications=()=>({devices:[],supported:false});';
    if(id==='\0query.jsx') return `import React from 'react';export function useQuery(o){const [s,set]=React.useState({});React.useEffect(()=>{let active=true;if(o.enabled)o.queryFn().then(data=>{if(active)set({data});},()=>{if(active)set({isError:true});});return()=>{active=false;};},[JSON.stringify(o.queryKey),o.enabled]);return s;}`;
    if(id==='\0ui.jsx') return `import React from 'react';const p=tag=>({children,variant,size,asChild,...props})=>React.createElement(tag,props,children);export const Card=p('section'),CardContent=p('div'),CardHeader=p('header'),CardTitle=p('h2'),CardDescription=p('p'),Button=p('button'),Badge=p('span'),DialogHeader=p('header'),DialogTitle=p('h2'),DialogDescription=p('p'),DialogFooter=p('footer'),DialogContent=p('div');export const Dialog=({open,children})=>open?<div role='dialog'>{children}</div>:null;`;
  },
}]});
const result=await bundle.generate({format:'iife'});await bundle.close();
const browser=await chromium.launch({headless:true,...(process.env.CLINICX_TEST_CHROMIUM_PATH?{executablePath:process.env.CLINICX_TEST_CHROMIUM_PATH}:{})});
let checks=0; const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
try {
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const requests=[],errors=[];
  await context.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const fresh=async(patch={})=>{
    await page.evaluate(p=>{const s=window.fixtureState;Object.assign(s,p);s.calls=[];s.toasts=[];s.remount=(s.remount||0)+1;window.rerender();},patch);
    if (patch.quote?.available === false) await page.getByText('Renewal quote:',{exact:false}).waitFor();
    else await page.getByText('Verified next charge:',{exact:false}).waitFor();
  };
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({content:result.output[0].code});
  await page.getByText('Current subscription · Growth',{exact:true}).waitFor();
  await page.getByText('Verified next charge:',{exact:false}).waitFor();
  check(await page.getByText('Popular',{exact:true}).count(),1);
  check(await page.getByText('Patient records added',{exact:true}).count(),2);
  check(await page.getByText('Not tracked',{exact:true}).count(),2);
  check(await page.getByRole('progressbar').count(),0);
  check(await page.getByRole('checkbox').isChecked(),false);
  const checklist=page.locator('#checklist');
  await checklist.getByRole('button',{name:'Skip',exact:true}).first().click();
  check(await checklist.getByText('skipped for now',{exact:false}).count(),1);
  await checklist.getByRole('button',{name:'Undo',exact:true}).click();
  check(await checklist.getByText('skipped for now',{exact:false}).count(),0);
  await page.getByRole('button',{name:'Yearly · see actual savings'}).click();
  check(await page.getByText('₹85,990',{exact:true}).count(),1);
  const selectProfessional=async()=>{await page.getByRole('button',{name:'Select plan',exact:true}).nth(1).click();await page.getByRole('button',{name:'Check eligibility & schedule change',exact:true}).click();};
  await selectProfessional();await page.getByText('Plan change scheduled for',{exact:false}).waitFor();
  check(await page.getByText('Current subscription · Growth',{exact:true}).count(),1);
  check(await page.evaluate(()=>window.fixtureState.calls.filter(c=>c.name==='startRazorpaySubscription'||c.name==='checkout-open').length),0);
  check(await page.getByText('Scheduled change — not current access',{exact:true}).count(),1);
  await page.getByRole('button',{name:'Load older payments',exact:true}).click();
  await page.getByText('CX-OLDER',{exact:false}).waitFor();
  check(await page.evaluate(()=>window.fixtureState.calls.find(c=>c.name==='listSubscriptionBillingPage'&&c.data.cursor)?.data.cursor),{id:invoiceId,created_at:'2026-10-01T00:00:00Z'});
  await page.getByRole('button',{name:'View invoice',exact:true}).first().click();
  await page.getByText('Historical period not verified',{exact:false}).waitFor();
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download verified invoice JSON'}).click();
  const download=await downloadEvent;const downloadPath=await download.path();
  check(JSON.parse(await fs.readFile(downloadPath,'utf8')).id,invoiceId);
  await fresh({quote,snapshot,mode:'normal'});
  await page.getByRole('button',{name:'Cancel future renewal',exact:true}).click();
  await page.getByLabel('Cancellation reason (optional)').fill('Cost');
  await page.getByRole('dialog').getByRole('button',{name:'Cancel future renewal',exact:true}).click();
  await page.getByText('Renewal is stopped.',{exact:false}).waitFor();
  check(await page.evaluate(()=>window.fixtureState.calls.find(c=>c.name==='cancelRazorpaySubscription').data.reason),'Cost');
  check(await page.getByRole('button',{name:'Check & resume merchant-paused renewal'}).isDisabled(),true);
  check(await page.getByText('Current subscription · Growth',{exact:true}).count(),1);
  await fresh({quote:{...quote,provider_status:'paused',will_renew:false,amount_paise:null},snapshot});
  await page.getByRole('button',{name:'Check & resume merchant-paused renewal'}).click();
  await page.waitForFunction(()=>window.fixtureState.toasts.some(t=>t.kind==='success'&&t.message.includes('resumed')));
  check(await page.evaluate(()=>window.fixtureState.calls.filter(c=>c.name==='startRazorpaySubscription').length),0);
  await page.getByLabel('Outstanding command ID (from billing support)').fill(commandId);
  await page.getByRole('button',{name:'Check existing command — no resend'}).click();
  await page.getByText('Existing command checked against provider evidence.',{exact:false}).waitFor();
  check(await page.evaluate(()=>window.fixtureState.calls.filter(c=>c.name==='reconcileRecurringSubscriptionCommand').length),1);
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Save email preference'}).click();
  await page.getByText('Server acknowledged email preference: on.',{exact:false}).waitFor();
  check(await page.evaluate(()=>window.fixtureState.calls.find(c=>c.name==='setClinicTrialEmailConsent').data),{organizationId:orgId,enabled:true});
  await fresh({quote,snapshot,mode:'missing-readback'});await selectProfessional();
  await page.getByText('Billing could not be confirmed.',{exact:false}).waitFor();
  check(await page.evaluate(()=>window.fixtureState.toasts.some(t=>t.kind==='success')),false);
  await fresh({quote,snapshot,mode:'unsupported'});await selectProfessional();
  await page.waitForFunction(()=>window.fixtureState.toasts.some(t=>t.message.includes('UPI/eMandate')));
  check(await page.evaluate(()=>window.fixtureState.calls.filter(c=>c.name==='startRazorpaySubscription').length),0);
  await fresh({quote,snapshot,mode:'wrong-invoice'});await page.getByRole('button',{name:'View invoice',exact:true}).first().click();
  await page.waitForFunction(()=>window.fixtureState.toasts.some(t=>t.message.includes('Invoice could not be verified')));
  check(await page.getByRole('button',{name:'Download verified invoice JSON'}).count(),0);
  // A pending operation must not update the next clinic (including A→B→A).
  await fresh({quote,snapshot,mode:'normal',defer:'changeRazorpaySubscription'});
  await page.getByRole('button',{name:'Select plan',exact:true}).nth(1).click();await page.getByRole('button',{name:'Check eligibility & schedule change'}).click();
  await page.waitForFunction(()=>!!window.fixtureState.release);
  await page.evaluate(id=>{const s=window.fixtureState;s.orgId=id;s.snapshot={...s.snapshot,organization_id:id};s.engagement={...s.engagement,organization_id:id};s.quote={available:false,reason:'No verified recurring mandate'};window.rerender();},otherId);
  await page.getByText('No verified recurring mandate',{exact:false}).waitFor();
  await page.evaluate(()=>{window.fixtureState.release();window.fixtureState.defer=null;});
  await page.waitForFunction(()=>!document.body.textContent.includes('Waiting for confirmation…'));
  check(await page.getByText('Plan change scheduled for',{exact:false}).count(),0);
  // Authorization-only checkout must remain pending, even with a success callback.
  await fresh({orgId,quote:{available:false,reason:'No verified recurring mandate'},snapshot:{...snapshot,effective_state:'trialing',subscription:{...snapshot.subscription,access_source:'trial'}},engagement,mode:'normal'}).catch(()=>{});
  await page.getByRole('button',{name:'Select plan',exact:true}).nth(1).click();await page.getByRole('button',{name:'Check eligibility & continue'}).click();
  await page.waitForFunction(()=>!!window.checkoutOptions);
  await page.evaluate(async()=>window.checkoutOptions.handler({razorpay_payment_id:'pay_fixture',razorpay_subscription_id:'sub_fixture',razorpay_signature:'a'.repeat(64)}));
  check(await page.getByText('Payment confirmation is pending.',{exact:false}).count(),1);
  check(await page.evaluate(()=>window.fixtureState.toasts.some(t=>t.kind==='success')),false);
  await page.screenshot({path:path.join(scratch,'billing-mobile.png'),fullPage:true});
  check(errors,[]);check(requests,[]);
  const report={result:'PASS',assertions:checks,external_requests:requests.length,page_errors:errors.length,scope:'Real billing/journey/comparison/settings components and handlers; synthetic offline server/query/catalog transports and UI/router primitives; fresh 390px Chromium context; not authenticated/provider E2E or styled visual certification'};
  await fs.writeFile(path.join(scratch,'browser-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
