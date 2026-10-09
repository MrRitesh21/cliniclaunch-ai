// Independent adversarial component contracts. All transports doubled; outbound aborted.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import ts from 'typescript';
import {rolldown} from 'rolldown';
import {chromium} from '@playwright/test';
const root=path.resolve(import.meta.dirname,'..');
const out=path.resolve(root,'..');
const source=await fs.readFile(path.join(root,'src/routes/_authenticated/dashboard.tsx'),'utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let boundary;
function visit(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==='AuthorityBoundary')boundary=node.getText(ast);ts.forEachChild(node,visit);}
visit(ast);assert.ok(boundary.includes('<Outlet />'));
const fixture=`
export const state=window.fixture={user:'22222222-2222-4222-8222-222222222222',org:'11111111-1111-4111-8111-111111111111',role:'owner',defer:false,fail:false,pending:[],updates:[],toasts:[],calls:[],mode:'portal',grants:[],inputCalls:0,keyUpCalls:0,actionCalls:0};
export const clinic={id:'55555555-5555-4555-8555-555555555555',organization_id:state.org,clinic_name:'Synthetic Clinic',hero_headline:'Original',lead_popup:{}};
export const useAuthReady=()=>({isReady:true,user:state.user?{id:state.user}:null});
export const readCache=()=>null;
export const writeCache=()=>{};
export const supabase={from(table){const query={};let update=null;const chain={select:()=>chain,eq:(k,v)=>{query[k]=v;return chain},order:()=>chain,limit:()=>chain,maybeSingle:()=>chain,update:value=>{update=value;return chain},then:(ok,bad)=>{if(update)state.updates.push({table,data:update,query,pending:state.grants.at(-1)?.pending});const data=table==='organization_members'?[{organization_id:state.org,role:state.role}]:table==='organizations'?{id:query.id}:table==='organization_modules'?[{module_id:'website_builder'},{module_id:'attendance'}]:table==='clinicx_feature_aliases'?[{alias:'website_builder',feature:'website_builder'}]:null;return Promise.resolve({data,error:null}).then(ok,bad);}};return chain;}};
export async function getClinicSubscription(){const result={organization_id:state.org,role:state.role,features:['website_builder','attendance'],can_read:true,can_write:true,effective_state:'trialing'};const fail=state.fail;state.calls.push({user:state.user});if(state.defer)await new Promise(resolve=>state.pending.push(resolve));if(fail)throw new Error('Synthetic offline failure');return result;}
export const submitClinicToGoogleServerFn=()=>{throw new Error('Forbidden in test');};
export const normalizeLeadPopup=value=>value||{};
`;
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';import {createPortal,flushSync} from 'react-dom';
import {useOrganization} from '${path.join(root,'src/hooks/useOrganization.ts')}';
import {AuthorityBoundary} from '${path.join(root,'src/components/app/AuthorityBoundary.tsx')}';
import {AppGuard} from '${path.join(root,'src/components/app/AppGuard.tsx')}';
import {WebsiteBuilderProvider,useWebsiteBuilder} from '${path.join(root,'src/features/website-builder/context/WebsiteBuilderContext.tsx')}';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '${path.join(root,'src/components/ui/dialog.tsx')}';
import {state,clinic} from 'virtual:fixture';
const recoveryRoute=()=>false;const Button=props=><button {...props}/>;const PullToRefresh=({children})=><div>{children}</div>;const SubscriptionExpiredView=()=> <div role="alert">Access expired</div>;
function PortalProbe(){const [draft,setDraft]=React.useState('SYNTHETIC PRIVATE NOTE');const [open,setOpen]=React.useState(false);return <><button onClick={()=>setOpen(true)}>Open protected dialog</button>{createPortal(<section aria-label="Plain protected portal"><p>{draft}</p><input aria-label="Portal input" value={draft} onInput={()=>state.inputCalls++} onChange={e=>setDraft(e.target.value)}/><button onClick={()=>state.actionCalls++} onKeyUp={()=>state.keyUpCalls++}>Portal action</button></section>,document.body)}<Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Protected clinical dialog</DialogTitle><DialogDescription>Synthetic protected draft content</DialogDescription><p>RADIX SYNTHETIC PRIVATE NOTE</p><input aria-label="Modal draft" defaultValue="RADIX SYNTHETIC PRIVATE NOTE"/><button onClick={()=>state.actionCalls++}>Modal save</button></DialogContent></Dialog></>;}
function EditorProbe(){const ctx=useWebsiteBuilder();return <><label>Editor draft<input aria-label="Editor draft" value={ctx.state.hero_headline} onChange={e=>ctx.patch({hero_headline:e.target.value})}/></label></>;}
const Outlet=()=>state.mode==='portal'?<AppGuard appKey="attendance"><PortalProbe/></AppGuard>:<AppGuard appKey="website_builder"><WebsiteBuilderProvider clinic={clinic}><EditorProbe/></WebsiteBuilderProvider></AppGuard>;
function DashboardSlot(){const {org,entitlement,authorityError,isSubscriptionExpired,refresh}=useOrganization();const pathname=state.mode==='portal'?'/dashboard/attendance':'/dashboard/website';return (${boundary});}
function Probe(){const ctx=useOrganization();state.grants.push({pending:ctx.authorityPending,entitlement:ctx.entitlement,role:ctx.role,scope:ctx.authorityScope});window.refreshAuthority=ctx.refresh;return <><button onClick={()=>void ctx.refresh()}>Force authority refresh</button><DashboardSlot/></>;}
const root=createRoot(document.getElementById('root'));window.renderFixture=()=>flushSync(()=>root.render(<Probe/>));renderFixture();
`;
const build=await rolldown({cwd:root,input:'virtual:entry',platform:'browser',plugins:[{name:'independent-safe-boundaries',resolveId(id){
 if(id==='virtual:entry')return '\0entry.jsx';
 if(['virtual:fixture','@/hooks/useAuthReady','@/integrations/supabase/client','@/lib/persist-cache','@/lib/subscription.functions','@/lib/gsc-pipeline.functions','@/components/clinic/lead-capture'].includes(id))return '\0fixture.js';
 if(id==='@tanstack/react-router')return '\0router.jsx';if(id==='@tanstack/react-start')return '\0start.js';if(id==='sonner')return '\0toast.js';
 if(id.startsWith('@/')){const base=path.join(root,'src',id.slice(2));return fs.access(base+'.tsx').then(()=>base+'.tsx',()=>base+'.ts');}
},load(id){if(id==='\0entry.jsx')return entry;if(id==='\0fixture.js')return fixture;if(id==='\0router.jsx')return `import React from 'react';export const Link=({to,children,...props})=><a href={to} {...props}>{children}</a>;`;if(id==='\0start.js')return 'export const useServerFn=f=>f;';if(id==='\0toast.js')return `import {state} from 'virtual:fixture';export const toast={success:m=>state.toasts.push(m),error:m=>state.toasts.push(m),info:m=>state.toasts.push(m)};`;}}]});
const generated=await build.generate({format:'iife'});await build.close();
const browser=await chromium.launch({headless:true});
const observations={};const failures=[];
try{
 async function fresh(mode){const context=await browser.newContext();await context.route('**/*',route=>route.abort());const page=await context.newPage();await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');await page.clock.install();await page.addScriptTag({content:generated.output.find(o=>o.type==='chunk').code});await page.waitForFunction(()=>fixture.grants.at(-1)?.entitlement?.can_write);if(mode==='editor'){await page.evaluate(()=>{fixture.mode='editor';renderFixture();});await page.getByLabel('Editor draft').waitFor();}return {context,page};}
 // Plain real createPortal: actions versus visibility/focus and uncovered React events.
 {
 const {context,page}=await fresh('portal');
 await page.evaluate(()=>{fixture.defer=true;void refreshAuthority();});await page.waitForFunction(()=>fixture.pending.length===1);
 const visible=await page.getByLabel('Plain protected portal').isVisible();
 const privateTextVisible=await page.getByText('SYNTHETIC PRIVATE NOTE',{exact:true}).isVisible();
 const inert=await page.getByLabel('Portal input').evaluate(el=>!!el.closest('[inert]'));
 await page.getByRole('button',{name:'Portal action',exact:true}).click();
 await page.getByLabel('Portal input').fill('INPUT DURING PENDING');
 await page.getByRole('button',{name:'Portal action',exact:true}).focus();await page.keyboard.up('Enter');
 const result=await page.evaluate(()=>({grants:fixture.grants.at(-1),inputCalls:fixture.inputCalls,keyUpCalls:fixture.keyUpCalls,clickCalls:fixture.actionCalls,focused:document.activeElement?.getAttribute('aria-label')}));
 observations.plainPortal={visible,privateTextVisible,inert,...result};
 if(visible||privateTextVisible||!inert)failures.push('Pending portal stays visible, non-inert and focusable');
 if(result.inputCalls||result.keyUpCalls)failures.push('Pending portal onInput/onKeyUp handlers execute despite empty grants');
 assert.equal(result.clickCalls,0,'Existing click capture must still block pending actions');
 await context.close();
 }
 // Actual application Radix Dialog wrapper: modal privacy and focus trap during pending.
 {
 const {context,page}=await fresh('portal');
 await page.getByRole('button',{name:'Open protected dialog'}).click();await page.getByRole('dialog').waitFor();
 await page.evaluate(()=>{fixture.defer=true;void refreshAuthority();});await page.waitForFunction(()=>fixture.pending.length===1);
 const result={dialogVisible:await page.getByRole('dialog').isVisible(),noteVisible:await page.getByText('RADIX SYNTHETIC PRIVATE NOTE',{exact:true}).isVisible(),modalInert:await page.getByLabel('Modal draft').evaluate(el=>!!el.closest('[inert]')),statusAriaHidden:await page.locator('[role="status"]').first().evaluate(el=>!!el.closest('[aria-hidden="true"]'))};
 await page.getByRole('button',{name:'Modal save',exact:true}).click();result.actionCalls=await page.evaluate(()=>fixture.actionCalls);
 await page.getByRole('button',{name:'Close',exact:true}).click();result.visibleAfterCloseClick=await page.getByRole('dialog').isVisible();
 observations.radixDialog=result;
 if(result.dialogVisible||result.noteVisible)failures.push('Actual Radix modal exposes protected draft while pending and close click is blocked');
 assert.equal(result.actionCalls,0);
 // Failures still drop portalled content: verify no weakening of actual failure.
 await page.evaluate(()=>{fixture.fail=true;fixture.pending.shift()();});
 // fail flag is captured at request start, so this release succeeds; force a fresh failing request.
 await page.waitForFunction(()=>fixture.grants.at(-1)?.entitlement?.can_write);
 await page.evaluate(()=>{fixture.defer=false;void refreshAuthority();});
 await page.getByRole('alert').filter({hasText:'could not be verified'}).waitFor();
 observations.radixDialog.afterFailureDialogCount=await page.getByRole('dialog').count();
 assert.equal(observations.radixDialog.afterFailureDialogCount,0);
 await context.close();
 }
 // Real WebsiteBuilderProvider, unchanged production effects: autosave and window shortcut.
 {
 const {context,page}=await fresh('editor');
 await page.getByLabel('Editor draft').fill('UNSAVED WEBSITE DRAFT');
 assert.equal(await page.evaluate(()=>fixture.updates.length),0);
 await page.evaluate(()=>{fixture.defer=true;void refreshAuthority();});await page.waitForFunction(()=>fixture.pending.length===1);
 assert.equal(await page.getByLabel('Editor draft').isVisible(),false);
 await page.clock.runFor(701);
 const afterAutosave=await page.evaluate(()=>({grants:fixture.grants.at(-1),updates:fixture.updates,visible:!!document.querySelector('[aria-label="Editor draft"]')?.checkVisibility()}));
 await page.getByRole('button',{name:'Force authority refresh'}).click();
 await page.keyboard.press('Control+s');
 await page.waitForFunction(()=>fixture.updates.length>1);
 observations.website={afterAutosave,afterShortcut:await page.evaluate(()=>({updates:fixture.updates,toasts:fixture.toasts,grants:fixture.grants.at(-1)}))};
 if(afterAutosave.updates.length)failures.push('Real website autosave sends clinics UPDATE during pending authority');
 if(observations.website.afterShortcut.updates.length>afterAutosave.updates.length)failures.push('Real website window Ctrl+S sends another clinics UPDATE while pending');
 await context.close();
 }
 observations.failedAssertions=failures;
 await fs.writeFile(path.join(out,'adversarial-observations.json'),JSON.stringify(observations,null,2));
 console.log(JSON.stringify(observations,null,2));
 assert.deepEqual(failures,[],'Independent fail-closed pending UI/effects contract');
}finally{await browser.close();}
