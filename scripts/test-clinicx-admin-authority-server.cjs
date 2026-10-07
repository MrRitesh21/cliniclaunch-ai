// Real TS implementations, synthetic auth/table transport; no environment or provider calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const {test}=require('node:test');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const file=path.resolve(__dirname,'../src/lib/admin.server.ts');
async function harness(role,run){
 const orig=Module._load, writes=[],rpcs=[];
 const service={from(table){const q={select(){return q},eq(){return q},in(){return q},update(v){writes.push([table,'update',v]);return q},insert(v){writes.push([table,'insert',v]);return q},upsert(v){writes.push([table,'upsert',v]);return q},delete(){writes.push([table,'delete']);return q},maybeSingle:async()=>({data:table==='subscriptions'?{id:'sub',current_period_end:new Date().toISOString()}: {id:'clinic',organization_id:'org',owner_id:'owner'},error:null}),then(resolve){resolve({data:table==='user_roles'?[{role}]:[],error:null})}};return q},auth:{admin:{generateLink:async()=>{writes.push(['auth','magiclink']);return {data:{properties:{action_link:'synthetic'}},error:null}},updateUserById:async()=>{writes.push(['auth','password']);return {error:null}}}}};
 Module._load=function(id){if(id==='@tanstack/react-start/server')return {getRequest:()=>new Request('http://fixture.test',{headers:{authorization:'Bearer synthetic'}})};
 if(id==='@supabase/supabase-js')return {createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'actor',email:'a@example.test'}},error:null})},rpc:async(name,args)=>{rpcs.push([name,args]);return {data:{success:true},error:null}}})};
 if(id==='@/integrations/supabase/client.server')return {supabaseAdmin:service};
 if(id.includes('razorpay')||id.includes('billing.server'))throw Error('No provider or owner impersonation permitted');return orig.apply(this,arguments)};
 delete require.cache[file];try{await run(require(file),writes,rpcs)}finally{Module._load=orig;delete require.cache[file]}
}
for(const role of ['support','super_admin']){
 for(const [name,input] of [
 ['changeDoctorPlanImpl',{clinicId:'clinic',planId:'professional',extendDays:90,grantFreeMonth:true}],
 ['changeDoctorPlanImpl',{clinicId:'clinic',planId:'free',cancelSub:true}],
 ['issueRefundImpl',{clinicId:'clinic',amount:999,reason:'test'}],
 ['deleteDoctorAccountImpl',{id:'clinic'}],['clearDoctorPatientsDataImpl',{id:'clinic'}],
 ['updateSubscriptionStatusImpl',{id:'sub',action:'reactivate'}],['updateSubscriptionStatusImpl',{id:'sub',action:'cancel'}],['updateSubscriptionStatusImpl',{id:'sub',action:'mark_expired'}],
 ['impersonateDoctorImpl',{clinicId:'clinic'}],['resetDoctorPasswordImpl',{clinicId:'clinic'}],['deleteAuditLogImpl',{id:'audit'}],
 ])test(`${role} ${name} rejects unsafe command before writes`,()=>harness(role,async(m,w)=>{await assert.rejects(m[name](input),/disabled|owner|retention|provider|audit/i);assert.deepEqual(w,[])}));
 for(const input of [{id:'clinic',planId:'free'},{id:'clinic',planId:null},{id:'clinic',status:'active'},{id:'clinic',periodEnd:'2040-01-01'},{id:'clinic',doctorName:'Safe',planId:'enterprise'}])
 test(`${role} profile rejects authority ${JSON.stringify(input)}`,()=>harness(role,async(m,w)=>{await assert.rejects(m.updateDoctorProfileImpl(input),/billing|authority|profile/i);assert.deepEqual(w,[])}));
 test(`${role} profile-only workflow preserves financial/clinical records`,()=>harness(role,async(m,w)=>{assert.deepEqual(await m.updateDoctorProfileImpl({id:'clinic',doctorName:'Corrected'}),{success:true});assert.deepEqual(w.map(x=>x.slice(0,2)),[['clinics','update'],['admin_audit_logs','insert']]);assert.deepEqual(w[0][2],{doctor_name:'Corrected'})}));
}
test('support cannot change global pricing, grants, financial settings or overrides',()=>harness('support',async(m,w)=>{for(const [fn,args] of [['updatePlanDetailsImpl',{}],['createPlanImpl',{}],['createCouponImpl',{}],['toggleCouponActiveImpl',{}],['deleteCouponImpl',{}],['saveSystemSettingsImpl',{trial_duration_days:'999'}],['toggleFeatureFlagImpl',{}],['updateFeatureFlagOverridesImpl',{}],['setModuleGlobalImpl',{}],['setOrgModuleOverrideImpl',{}]])await assert.rejects(m[fn](args),/Super Admin|disabled/i);assert.deepEqual(w,[])}));
test('documented override uses verified caller RPC not service role or captured money',()=>harness('super_admin',async(m,w,r)=>{assert.deepEqual(await m.grantAdminDocumentedOverrideImpl({organizationId:'00000000-0000-4000-8000-000000000099',planId:'growth',expiresAt:'2026-10-08T00:00:00Z',reason:'Approved support exception'}),{success:true});assert.deepEqual(w,[]);assert.equal(r[0][0],'clinicx_admin_documented_override')}));
