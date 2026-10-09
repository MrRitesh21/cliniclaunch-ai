// Component contracts only: no app bootstrap, real credentials, or network requests.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { rolldown } from 'rolldown';
import { chromium } from '@playwright/test';
const root=path.resolve(import.meta.dirname,'..');
const scratch=process.env.CLINICX_ATTENDANCE_SCRATCH;
assert.ok(scratch?.startsWith('/Users/ritesh/.hermes/profiles/sara/cache/scratch/'),'Use approved scratch');
const route=path.join(root,'src/routes/_authenticated/dashboard.attendance.tsx');
assert.ok(await fs.access(route).then(()=>true,()=>false),'Attendance route must exist');
await fs.mkdir(scratch,{recursive:true});
const fixture=`
import React from 'react';
export const state=window.fixture={org:'11111111-1111-4111-8111-111111111111',role:'owner',write:true,calls:[],records:[],toasts:[],defer:false,pending:[],fail:false};
const staff={staff_id:'user:22222222-2222-4222-8222-222222222222',staff_name:'Alice',staff_role:'staff',clinic_id:null};
export const useOrganization=()=>{const org=React.useMemo(()=>({id:state.org}),[state.org]);return {org,role:state.role,installedModuleIds:state.installed?['attendance']:[],planModuleIds:['attendance'],unavailableModuleIds:[],authorityUserId:state.authorityUserId||state.user||'22222222-2222-4222-8222-222222222222',authorityGeneration:state.authorityGeneration||0,authorityError:state.authorityError||null,entitlement:{can_read:true,can_write:state.write},refresh:async()=>{state.refreshes=(state.refreshes||0)+1;if(state.bumpAuthorityOnRefresh)state.authorityGeneration=(state.authorityGeneration||0)+1;window.renderAttendance();}};};
export const useAuthReady=()=>({isReady:true,user:{id:state.user||'22222222-2222-4222-8222-222222222222'}});
export const supabase={from(table){let action='read';const chain={select:()=>chain,order:()=>chain,eq:()=>chain,maybeSingle:()=>chain,delete:()=>{action='delete';return chain},upsert:()=>{action='upsert';return chain},then:async(resolve)=>{
 state.calls.push({name:'store-'+action,table});if(action!=='read'){if(state.deferStore)await new Promise(resolve=>state.releaseStore=resolve);if(state.fail)return resolve({data:null,error:{message:'Offline'}});if(!state.missingReadback)state.installed=action==='upsert';return resolve({data:null,error:null});}
 const data=table==='modules'?[{id:'attendance',name:'Staff Attendance',description:'Attendance',category:'Operations',icon:'Clock',min_plan:'professional',is_available:true,is_core:false,sort_order:91,created_at:'2026-10-09'}]:table==='organization_modules'?(state.installed?[{module_id:'attendance'}]:[]):table==='plans'?[]:null;
 if(table==='organization_modules'&&state.deferReadback)await new Promise(resolve=>state.releaseReadback=resolve);
 return resolve({data,error:null});
}};return chain;}};
export async function getAttendanceDay({data}){
 state.calls.push({name:'read',data});const org=data.organizationId;const date=data.date||'2026-10-09';
 const result={organization_id:org,date,today:'2026-10-09',timezone:'Asia/Kolkata',server_now:'2026-10-09T04:00:00Z',self_id:staff.staff_id,can_manage:state.role==='owner',can_write:state.write,roster:[{...staff,staff_name:state.name||staff.staff_name}],records:state.records,open_records:state.records.filter(r=>r.check_in&&!r.check_out)};
 if(state.defer) await new Promise(resolve=>state.pending.push(()=>resolve()));
 return result;
}
export async function saveAttendance({data}){
 state.calls.push({name:'save',data});if(state.defer) await new Promise(resolve=>state.pending.push(()=>resolve()));
 if(state.fail) throw new Error('Connection unavailable. Retry to verify attendance.');
 const old=state.records[0]; const row={...staff,id:state.org,organization_id:data.organizationId,attendance_date:data.date||'2026-10-09',status:data.status||'present',shift:data.shift||'morning',working_hours:0,notes:data.notes||null,check_in:data.action==='set_status'?(old?.check_in||null):(old?.check_in||'2026-10-09T04:00:00Z'),check_out:data.action==='check_out'?'2026-10-09T12:00:00Z':null,created_at:'2026-10-09T04:00:00Z',updated_at:'2026-10-09T04:00:00Z'};
 state.records=[row];return row;
}
`;
const bundle=await rolldown({cwd:root,input:'virtual:entry',platform:'browser',plugins:[{
 name:'attendance-offline-boundaries',resolveId(id){
  if(id==='virtual:entry')return '\0entry.jsx';
  if(id==='virtual:fixture'||id==='@/hooks/useOrganization'||id==='@/hooks/useAuthReady'||id==='@/integrations/supabase/client'||id==='@/lib/attendance.functions')return '\0fixture.jsx';
  if(id==='@tanstack/react-router')return '\0router.jsx';
  if(id==='@tanstack/react-start')return '\0start.js';
  if(id==='@/components/app/AppGuard')return '\0guard.jsx';
  if(id==='sonner')return '\0toast.js';
  if(id.startsWith('@/')){const base=path.join(root,'src',id.slice(2));return fs.access(base+'.tsx').then(()=>base+'.tsx',()=>base+'.ts');}
 },load(id){
  if(id==='\0entry.jsx')return `import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import {Route} from '${route}';import {Route as Store} from '${path.join(root,'src/routes/_authenticated/dashboard.modules.tsx')}';import {state} from 'virtual:fixture';const root=createRoot(document.getElementById('root'));window.renderAttendance=()=>flushSync(()=>root.render(state.unmount?null:state.store?<Store.component/>:<Route.component/>));window.renderAttendance();`;
  if(id==='\0fixture.jsx')return fixture;
  if(id==='\0router.jsx')return `import React from 'react';export const createFileRoute=()=>options=>options;export const Link=({to,children,...props})=><a href={to} {...props}>{children}</a>;`;
  if(id==='\0start.js')return 'export const useServerFn=f=>f;';
  if(id==='\0guard.jsx')return `export const AppGuard=({children})=>children;`;
  if(id==='\0toast.js')return `import {state} from 'virtual:fixture';export const toast={success:s=>state.toasts.push(s),error:s=>state.toasts.push('ERROR '+s)};`;
 }
}]});
const generated=await bundle.generate({format:'iife'});await bundle.close();
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route=>route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
 if(process.env.CLINICX_ATTENDANCE_CSS) await page.addStyleTag({content:await fs.readFile(process.env.CLINICX_ATTENDANCE_CSS,'utf8')});
 await page.addScriptTag({content:generated.output.find(item=>item.type==='chunk').code});
 await page.getByRole('heading',{name:'Staff Attendance',exact:true}).waitFor();
 await page.getByRole('button',{name:'Check in Alice',exact:true}).waitFor();
 await page.evaluate(()=>{fixture.authorityUserId='different-caller';renderAttendance();});
 await page.waitForTimeout(50);
 assert.equal(await page.getByRole('button',{name:'Check in Alice',exact:true}).count(),0,'Attendance controls require caller-bound verified authority');
 assert.equal(await page.getByLabel('Status for Alice',{exact:true}).count(),0,'Unverified caller must not manage attendance');
 await page.evaluate(()=>{fixture.authorityUserId=null;renderAttendance();});
 await page.getByRole('button',{name:'Check in Alice',exact:true}).waitFor();
 if(process.env.CLINICX_ATTENDANCE_CSS){
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile attendance must not overflow');
  await page.screenshot({path:path.join(scratch,'attendance-mobile-light.png'),fullPage:true});
  await page.evaluate(()=>document.documentElement.classList.add('dark'));
  await page.screenshot({path:path.join(scratch,'attendance-mobile-dark.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Desktop attendance must not overflow');
  await page.screenshot({path:path.join(scratch,'attendance-desktop-dark.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
 }
 await page.getByRole('button',{name:'Check in Alice',exact:true}).click();
 await page.getByRole('button',{name:'Check out Alice',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='save').length),1);
 await page.getByRole('button',{name:'Check out Alice',exact:true}).click();
 await page.getByText('Completed',{exact:true}).last().waitFor();
 await page.getByLabel('Status for Alice',{exact:true}).selectOption('late');
 await page.getByRole('button',{name:'Save status for Alice'}).click();
 assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='save').at(-1).data.status),'late');
 await page.evaluate(()=>{fixture.role='staff';fixture.records=[];renderAttendance();});
 await page.getByRole('button',{name:'Refresh attendance'}).click();
 await page.getByRole('button',{name:'Check in Alice',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Status for Alice',{exact:true}).count(),0);
 await page.evaluate(()=>fixture.fail=true);
 await page.getByRole('button',{name:'Check in Alice',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Connection unavailable'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Check out Alice',exact:true}).count(),0);
 // Delayed write from A must not update the UI or emit a success after A -> B -> A.
 await page.evaluate(()=>{fixture.fail=false;fixture.defer=true;});
 await page.getByRole('button',{name:'Check in Alice',exact:true}).click();
 await page.evaluate(()=>{fixture.org='33333333-3333-4333-8333-333333333333';renderAttendance();});
 await page.waitForFunction(()=>fixture.calls.some(c=>c.name==='read'&&c.data.organizationId.startsWith('3333')));
 await page.evaluate(()=>{fixture.org='11111111-1111-4111-8111-111111111111';renderAttendance();});
 await page.waitForFunction(()=>fixture.pending.length>=3);
 const successes=await page.evaluate(()=>fixture.toasts.length);
 await page.evaluate(()=>{fixture.defer=false;fixture.pending.shift()();});
 await page.waitForTimeout(50);
 assert.equal(await page.evaluate(()=>fixture.toasts.length),successes);
 await page.evaluate(()=>{fixture.records=[];fixture.pending.splice(0).forEach(release=>release());});
 await page.getByRole('button',{name:'Check in Alice',exact:true}).waitFor();
 await page.evaluate(()=>{fixture.write=false;renderAttendance();});
 await page.getByRole('button',{name:'Refresh attendance'}).click();
 await page.getByText(/read-only/i).waitFor();
 assert.equal(await page.getByRole('button',{name:'Check in Alice',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Export CSV'}).count(),1);
 await page.screenshot({path:path.join(scratch,'attendance-mobile.png'),fullPage:true});
 await page.evaluate(()=>fixture.defer=true);
 await page.getByRole('button',{name:'Refresh attendance'}).click();
 await page.waitForFunction(()=>fixture.pending.length===1);
 await page.evaluate(()=>{fixture.user='44444444-4444-4444-8444-444444444444';fixture.name='Bob';renderAttendance();});
 await page.waitForFunction(()=>fixture.pending.length===2);
 await page.evaluate(()=>{fixture.defer=false;fixture.pending.splice(0).forEach(release=>release());});
 await page.getByRole('heading',{name:'Bob',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Alice',exact:true}).count(),0);
 await page.evaluate(()=>{fixture.store=true;fixture.role='owner';fixture.write=true;fixture.records=[];fixture.missingReadback=true;renderAttendance();});
 const install=page.getByRole('button',{name:'Install App',exact:true});
 await install.waitFor();await install.click();
 await page.waitForFunction(()=>fixture.toasts.some(s=>s.includes('not confirmed')));
 assert.equal(await page.getByRole('link',{name:'Open App',exact:true}).count(),0);
 await page.evaluate(()=>{fixture.missingReadback=false;fixture.fail=true;});
 await install.click();await page.waitForFunction(()=>fixture.toasts.some(s=>s.startsWith('ERROR')&&s.includes('installation failed')));
 assert.equal(await page.getByRole('link',{name:'Open App',exact:true}).count(),0);
 await page.evaluate(()=>fixture.fail=false);await install.click();
 await page.getByRole('link',{name:'Open App',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Open App',exact:true}).getAttribute('href'),'/dashboard/attendance');
 await page.evaluate(()=>{fixture.installed=false;fixture.bumpAuthorityOnRefresh=true;renderAttendance();});
 const confirmedToasts=await page.evaluate(()=>fixture.toasts.length);
 await install.click();await page.getByRole('link',{name:'Open App',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>fixture.toasts.length),confirmedToasts+1,'Confirmed current install still notifies when its own refresh advances authority');
 await page.evaluate(()=>fixture.bumpAuthorityOnRefresh=false);
 await page.evaluate(()=>{fixture.role='staff';renderAttendance();});
 await page.getByRole('button',{name:/Details/}).first().click();
 assert.equal(await page.getByRole('button',{name:'Uninstall Module'}).isDisabled(),true);
 await page.getByRole('button',{name:'Close',exact:true}).first().click();
 await page.evaluate(()=>{fixture.role='owner';fixture.installed=false;fixture.deferStore=true;renderAttendance();});
 await install.click();await page.waitForFunction(()=>!!fixture.releaseStore);
 await page.evaluate(()=>{fixture.org='33333333-3333-4333-8333-333333333333';renderAttendance();});
 await install.waitFor();
 assert.equal(await install.isEnabled(),true,'An old tenant installation must not leave the new tenant busy');
 const toastCount=await page.evaluate(()=>fixture.toasts.length);
 await page.evaluate(()=>{fixture.deferStore=false;fixture.releaseStore();});await page.waitForTimeout(50);
 assert.equal(await page.evaluate(()=>fixture.toasts.length),toastCount,'Old tenant install cannot toast success');
 // Switch after mutation but during readback: even refresh is forbidden for stale authority.
 for(const change of ['caller','role','authority','round-trip','unmount']){
  await page.evaluate(()=>{fixture.unmount=false;fixture.user=null;fixture.role='owner';fixture.write=true;fixture.installed=false;fixture.deferReadback=true;fixture.releaseReadback=null;renderAttendance();});
  await install.waitFor();await install.click();await page.waitForFunction(()=>!!fixture.releaseReadback);
  const before=await page.evaluate(()=>({toasts:fixture.toasts.length,refreshes:fixture.refreshes||0}));
  await page.evaluate(change=>{if(change==='caller'||change==='round-trip')fixture.user='55555555-5555-4555-8555-555555555555';if(change==='role')fixture.role='staff';if(change==='authority')fixture.authorityGeneration=(fixture.authorityGeneration||0)+1;if(change==='unmount')fixture.unmount=true;renderAttendance();},change);
  await page.waitForTimeout(30);
  if(change==='round-trip'){await page.evaluate(()=>{fixture.user=null;renderAttendance();});await page.waitForTimeout(30);}
  await page.evaluate(()=>{fixture.deferReadback=false;fixture.releaseReadback();});await page.waitForTimeout(50);
  assert.equal(await page.evaluate(()=>fixture.refreshes||0),before.refreshes,change+' during readback must discard before refresh');
  assert.equal(await page.evaluate(()=>fixture.toasts.length),before.toasts,change+' during readback must not emit success');
 }
 assert.deepEqual(errors,[]);
 console.log('PASS attendance browser: caller-bound controls, check-in/out, admin status, staff restrictions, offline error, A→B→A stale write, read-only export, App Store install/readback/open, and caller/role/authority/round-trip/unmount readback invalidation before refresh/toast; 0 page errors. Component contracts, not live auth/PostgREST E2E.');
 await context.close();
} finally {await browser.close();}
