// Real React shared hook + real AppGuard + Attendance route; transport/cache only are doubled.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import {rolldown} from 'rolldown';
import {chromium} from '@playwright/test';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
const org='11111111-1111-4111-8111-111111111111';
const owner='22222222-2222-4222-8222-222222222222';
const staff='44444444-4444-4444-8444-444444444444';
// Exercise the actual DashboardLayout Outlet/access JSX without bootstrapping its
// unrelated clinic/profile/admin/PWA services. Only those shell imports are doubled.
const dashboardText=await fs.readFile(path.join(root,'src/routes/_authenticated/dashboard.tsx'),'utf8');
const dashboardSource=ts.createSourceFile('dashboard.tsx',dashboardText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let dashboardBoundary;
function findBoundary(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(dashboardSource)==='AuthorityBoundary')dashboardBoundary=node.getText(dashboardSource);ts.forEachChild(node,findBoundary);}
findBoundary(dashboardSource);assert.ok(dashboardBoundary?.includes('<Outlet />'),'Actual DashboardLayout must preserve its Outlet inside AuthorityBoundary');
const fixture=`
export const state=window.fixture={user:'${owner}',org:'${org}',role:'owner',defer:true,fail:false,calls:[],pending:[],renders:[],writes:[],formWrites:0,cached:{org:{id:'${org}'},role:'owner',entitlement:{can_write:true,can_read:true},authorityError:null,planModuleIds:['attendance'],installedModuleIds:['attendance']}};
export const useAuthReady=()=>({isReady:true,user:state.user?{id:state.user}:null});
export const readCache=()=>state.cached;
export const writeCache=(key,value)=>{state.writes.push({key,value});state.cached=value;};
export const supabase={from(table){let query={};const chain={select:()=>chain,eq:(k,v)=>{query[k]=v;return chain},order:()=>chain,limit:()=>chain,maybeSingle:()=>chain,then:(ok,bad)=>{const data=table==='organization_members'?[{organization_id:state.org,role:state.role}]:table==='organizations'?{id:query.id}:table==='organization_modules'?[{module_id:'attendance'}]:table==='clinicx_feature_aliases'?[{alias:'attendance',feature:'staff_management'}]:table==='subscriptions'?null:[];return Promise.resolve({data,error:null}).then(ok,bad);}};return chain;}};
export async function getClinicSubscription(){const result={organization_id:state.org,role:state.role,features:['staff_management'],can_read:state.canRead!==false,can_write:true,effective_state:'trialing'};const fail=state.fail;state.calls.push({user:state.user,role:state.role});if(state.defer)await new Promise(resolve=>state.pending.push(resolve));if(fail)throw new Error('Offline fixture');return result;}
export async function getAttendanceDay({data}){const self='user:'+state.user;return {organization_id:data.organizationId,date:data.date||'2026-10-09',today:'2026-10-09',timezone:'Asia/Kolkata',server_now:'2026-10-09T04:00:00Z',self_id:self,can_manage:state.role==='owner',can_write:true,roster:[{staff_id:self,staff_name:'Alice',staff_role:state.role,clinic_id:null}],records:[],open_records:[]};}
export const saveAttendance=()=>{throw new Error('Not used in authority contracts');};
`;
const build=await rolldown({cwd:root,input:'virtual:entry',platform:'browser',plugins:[{name:'real-attendance-authority-boundaries',resolveId(id){
 if(id==='virtual:entry')return '\0entry.jsx';
 if(['virtual:fixture','@/hooks/useAuthReady','@/integrations/supabase/client','@/lib/persist-cache','@/lib/subscription.functions','@/lib/attendance.functions'].includes(id))return '\0fixture.js';
 if(id==='@tanstack/react-router')return '\0router.jsx';
 if(id==='@tanstack/react-start')return '\0start.js';
 if(id==='sonner')return '\0toast.js';
 if(id.startsWith('@/')){const base=path.join(root,'src',id.slice(2));return fs.access(base+'.tsx').then(()=>base+'.tsx',()=>base+'.ts');}
},load(id){
 if(id==='\0fixture.js')return fixture;
 if(id==='\0entry.jsx')return `import React from 'react';import {createRoot} from 'react-dom/client';import {createPortal,flushSync} from 'react-dom';import {useOrganization} from '${path.join(root,'src/hooks/useOrganization.ts')}';import {AuthorityBoundary} from '${path.join(root,'src/components/app/AuthorityBoundary.tsx')}';import {Route} from '${path.join(root,'src/routes/_authenticated/dashboard.attendance.tsx')}';import {state} from 'virtual:fixture';const recoveryRoute=()=>false;const Button=props=><button {...props}/>;const PullToRefresh=({children})=><div>{children}</div>;const SubscriptionExpiredView=()=> <div role="alert">Access expired</div>;function DraftProbe(){const ctx=useOrganization();const [value,setValue]=React.useState('');return <><form onSubmit={e=>{e.preventDefault();if(ctx.entitlement?.can_write&&!ctx.authorityError)state.formWrites++;}}><input aria-label="Other protected draft" value={value} onChange={e=>setValue(e.target.value)}/><button type="submit" disabled={!ctx.entitlement?.can_write}>Save other draft</button></form>{createPortal(<button onClick={()=>state.formWrites++}>Portalled protected action</button>,document.body)}</>;}const Outlet=()=> <><DraftProbe/><Route.component/></>;function DashboardSlot(){const {org,entitlement,authorityError,isSubscriptionExpired,refresh}=useOrganization();const pathname='/dashboard/attendance';return (${dashboardBoundary});}function Probe(){const ctx=useOrganization();state.renders.push({user:state.user,org:ctx.org?.id,role:ctx.role,entitlement:ctx.entitlement,authorityUserId:ctx.authorityUserId,plan:ctx.planModuleIds,pending:ctx.authorityPending,scope:ctx.authorityScope});window.refreshAuthority=ctx.refresh;return <><button onClick={()=>void ctx.refresh()}>Force authority refresh</button><DashboardSlot/></>;}const root=createRoot(document.getElementById('root'));window.renderFixture=()=>flushSync(()=>root.render(<Probe/>));window.renderFixture();`;
 if(id==='\0router.jsx')return `import React from 'react';export const createFileRoute=()=>options=>options;export const Link=({to,children,...props})=><a href={to} {...props}>{children}</a>;`;
 if(id==='\0start.js')return 'export const useServerFn=f=>f;';
 if(id==='\0toast.js')return 'export const toast={success:()=>{},error:()=>{}};';
}}]});
const generated=await build.generate({format:'iife'});await build.close();
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();await context.route('**/*',route=>route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');await page.clock.install();await page.addScriptTag({content:generated.output.find(o=>o.type==='chunk').code});
 await page.waitForFunction(()=>fixture.pending.length===1);
 assert.equal(await page.getByRole('button',{name:'Check in Alice'}).count(),0,'Persisted owner must not expose controls through real AppGuard');
 assert.equal(await page.getByLabel('Status for Alice',{exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>fixture.renders[0].entitlement),null);
 await page.evaluate(()=>{fixture.defer=false;fixture.pending.shift()();});
 await page.getByRole('button',{name:'Check in Alice'}).waitFor();
 assert.equal(await page.getByLabel('Status for Alice',{exact:true}).count(),1);
 assert.deepEqual(await page.evaluate(()=>fixture.writes[0].value),{org:{id:org}});
 // RED regression: a routine periodic/focus refresh must retain unsaved form state.
 const notes=page.getByLabel('Notes for Alice',{exact:true});
 await notes.fill('UNSAVED ATTENDANCE DRAFT');
 await page.getByLabel('Attendance date',{exact:true}).fill('2026-10-08');
 await notes.waitFor();await notes.fill('UNSAVED ATTENDANCE DRAFT');
 await page.getByLabel('Other protected draft').fill('UNSAVED OTHER DRAFT');
 await page.getByLabel('Status for Alice',{exact:true}).selectOption('late');
 await page.evaluate(()=>fixture.defer=true);
 await page.clock.runFor(60001);
 await page.waitForFunction(()=>fixture.pending.length===1);
 const during=await page.evaluate(()=>fixture.renders.at(-1));
 assert.equal(during.pending,true);assert.equal(during.entitlement,null);assert.equal(during.role,null);assert.deepEqual(during.plan,[]);
 assert.equal(await page.getByRole('button',{name:'Check in Alice'}).count(),0,'Pending freshness cannot expose punch controls');
 assert.equal(await page.getByLabel('Other protected draft').isVisible(),false,'Mounted drafts stay hidden during verification');
 assert.equal(await page.getByLabel('Other protected draft').evaluate(el=>!!el.closest('[inert]')),true);
 await page.getByRole('button',{name:'Save other draft',includeHidden:true}).evaluate(el=>el.click());
 assert.equal(await page.evaluate(()=>fixture.formWrites),0,'Hidden stale UI cannot save');
 await page.getByRole('button',{name:'Portalled protected action'}).click();
 assert.equal(await page.evaluate(()=>fixture.formWrites),0,'Pending boundary must also block portalled protected actions');
 await page.evaluate(()=>{fixture.defer=false;fixture.pending.shift()();});
 await notes.waitFor();
 assert.equal(await notes.inputValue(),'UNSAVED ATTENDANCE DRAFT','Successful periodic authority refresh must preserve attendance Notes');
 assert.equal(await page.getByLabel('Attendance date',{exact:true}).inputValue(),'2026-10-08');
 assert.equal(await page.getByLabel('Status for Alice',{exact:true}).inputValue(),'late');
 assert.equal(await page.getByLabel('Other protected draft').inputValue(),'UNSAVED OTHER DRAFT');
 await page.clock.setSystemTime(new Date(await page.evaluate(()=>Date.now())+60001));
 await page.evaluate(()=>{fixture.defer=true;window.dispatchEvent(new Event('focus'));});
 await page.waitForFunction(()=>fixture.pending.length===1);
 await page.evaluate(()=>{fixture.defer=false;fixture.pending.shift()();});
 await notes.waitFor();assert.equal(await notes.inputValue(),'UNSAVED ATTENDANCE DRAFT','Successful focus authority refresh must preserve attendance Notes');
 assert.equal(await page.getByLabel('Other protected draft').inputValue(),'UNSAVED OTHER DRAFT');
 const writesBeforeFailure=await page.evaluate(()=>fixture.writes.length);
 await page.evaluate(()=>fixture.fail=true);await page.getByRole('button',{name:'Force authority refresh'}).click();
 await page.getByRole('alert').filter({hasText:'could not be verified'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Check in Alice'}).count(),0);
 assert.equal(await page.getByLabel('Status for Alice',{exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>fixture.writes.length),writesBeforeFailure,'Transport failure cannot renew persisted cache');
 await page.evaluate(()=>fixture.fail=false);await page.getByRole('button',{name:'Retry access check'}).click();
 await page.getByRole('button',{name:'Check in Alice'}).waitFor();
 assert.equal(await notes.inputValue(),'','Actual failure discards the old draft subtree');
 assert.equal(await page.getByLabel('Other protected draft').inputValue(),'');
 await notes.fill('OLD ACCOUNT DRAFT');await page.getByLabel('Other protected draft').fill('OLD ACCOUNT DRAFT');
 await page.evaluate(staff=>{fixture.defer=true;fixture.user=staff;fixture.role='staff';fixture.renders=[];renderFixture();},staff);
 const first=await page.evaluate(()=>fixture.renders[0]);assert.equal(first.entitlement,null);assert.equal(first.role,null);assert.deepEqual(first.plan,[]);
 await page.waitForFunction(()=>fixture.pending.length===1);
 assert.equal(await page.getByRole('button',{name:'Check in Alice'}).count(),0);
 await page.evaluate(()=>{fixture.defer=false;fixture.pending.shift()();});await page.getByRole('button',{name:'Check in Alice'}).waitFor();
 assert.equal(await page.getByLabel('Status for Alice',{exact:true}).count(),0,'Verified staff can self-punch but cannot correct status');
 assert.equal(await page.getByLabel('Other protected draft').inputValue(),'','Same-tenant account switch cannot retain previous caller drafts');
 assert.equal(await page.evaluate(()=>fixture.renders.at(-1).authorityUserId),staff);
 // First A response and B response must not revive old authority after A -> B -> A.
 await page.evaluate(()=>{fixture.defer=true;void refreshAuthority();});await page.waitForFunction(()=>fixture.pending.length===1);
 await page.evaluate(owner=>{fixture.user=owner;fixture.role='owner';renderFixture();},owner);await page.waitForFunction(()=>fixture.pending.length===2);
 await page.evaluate(staff=>{fixture.user=staff;fixture.role='staff';renderFixture();},staff);await page.waitForFunction(()=>fixture.pending.length===3);
 await page.evaluate(()=>{fixture.pending.shift()();fixture.pending.shift()();});await page.waitForTimeout(40);
 assert.equal(await page.getByRole('button',{name:'Check in Alice'}).count(),0,'Stale A/B authority cannot unlock latest A');
 await page.evaluate(()=>{fixture.defer=false;fixture.pending.shift()();});await page.getByRole('button',{name:'Check in Alice'}).waitFor();
 // Successful membership moves cannot expose retained old-tenant drafts.
 await page.getByLabel('Other protected draft').fill('OLD TENANT DRAFT');
 await page.evaluate(()=>{fixture.org='33333333-3333-4333-8333-333333333333';fixture.role='owner';void refreshAuthority();});
 await notes.waitFor();assert.equal(await notes.inputValue(),'');
 assert.equal(await page.getByLabel('Other protected draft').inputValue(),'','Tenant/role change drops old draft subtree');
 await notes.fill('TENANT B DRAFT');
 await page.evaluate(org=>{fixture.org=org;void refreshAuthority();},org);
 await notes.waitFor();assert.equal(await notes.inputValue(),'','Returning to old tenant does not revive a draft');
 await notes.fill('TIMED OUT DRAFT');
 const writesBeforeTimeout=await page.evaluate(()=>fixture.writes.length);
 await page.evaluate(()=>{fixture.defer=true;void refreshAuthority();});
 await page.waitForFunction(()=>fixture.pending.length===1);
 await page.clock.runFor(10001);
 await page.getByRole('alert').filter({hasText:'could not be verified'}).waitFor();
 assert.equal(await notes.count(),0,'Timeout must discard the old draft subtree');
 await page.evaluate(()=>{fixture.defer=false;fixture.pending.shift()();});
 assert.equal(await page.evaluate(()=>fixture.writes.length),writesBeforeTimeout,'Late success after timeout cannot renew authority');
 assert.equal(await page.getByRole('button',{name:'Check in Alice'}).count(),0,'Late response cannot re-enable expired grants');
 await page.getByRole('button',{name:'Retry access check'}).click();await notes.waitFor();
 assert.equal(await notes.inputValue(),'');
 await notes.fill('SAME ROLE ACCOUNT DRAFT');await page.getByLabel('Other protected draft').fill('SAME ROLE ACCOUNT DRAFT');
 await page.evaluate(owner=>{fixture.defer=true;fixture.user=owner;fixture.renders=[];renderFixture();},owner);
 assert.equal(await page.evaluate(()=>fixture.renders[0].entitlement),null,'Same-role account switch must fail closed before effects');
 assert.equal(await notes.count(),0,'Same-role account switch immediately removes the previous caller draft');
 await page.waitForFunction(()=>fixture.pending.length===1);
 await page.evaluate(()=>{fixture.defer=false;fixture.pending.shift()();});await notes.waitFor();
 assert.equal(await notes.inputValue(),'');assert.equal(await page.getByLabel('Other protected draft').inputValue(),'');
 await notes.fill('OWNER ONLY DRAFT');await page.getByLabel('Other protected draft').fill('OWNER ONLY DRAFT');
 await page.evaluate(()=>{fixture.role='staff';void refreshAuthority();});
 await page.getByRole('button',{name:'Check in Alice'}).waitFor();
 assert.equal(await notes.count(),0,'Same-caller role downgrade cannot retain management forms');
 assert.equal(await page.getByLabel('Other protected draft').inputValue(),'','Role change drops protected drafts');
 await page.evaluate(()=>{fixture.role='owner';void refreshAuthority();});await notes.waitFor();assert.equal(await notes.inputValue(),'');
 await page.evaluate(()=>{fixture.canRead=false;void refreshAuthority();});
 await page.getByRole('alert').filter({hasText:'Access expired'}).waitFor();
 assert.equal(await notes.count(),0,'Successful revoked authority must not retain protected drafts');
 await page.evaluate(()=>{fixture.user=null;fixture.renders=[];renderFixture();});
 assert.equal(await page.evaluate(()=>fixture.renders[0].entitlement),null);
 assert.equal(await page.getByRole('button',{name:'Check in Alice'}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS real hook/AppGuard/Dashboard Outlet contracts: periodic + focus refresh retain Notes/date/status and other protected drafts; pending hidden/inert with empty grants/no writes; failure/no renewed cache; same-tenant caller isolation; tenant/role change and revocation discard drafts; staff self-only; A→B→A stale authority/sign-out; 0 page errors; all outbound requests aborted.');await context.close();
}finally{await browser.close();}
