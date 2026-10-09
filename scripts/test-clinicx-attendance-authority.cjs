// Actual shared loader/render contracts with explicit transport/cache boundaries; no app bootstrap.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function harness(persisted=null) {
 const state={user:'owner',calls:0,fail:false,defer:false,pending:[],writes:[],now:100000};
 const responses={organization_members:[{organization_id:'org',role:'owner'}],organizations:{id:'org'},organization_modules:[{module_id:'attendance'}],subscriptions:null,modules:[],organization_module_overrides:[],clinicx_feature_aliases:[{alias:'attendance',feature:'staff_management'}]};
 const chain=table=>{const q={then:(ok,bad)=>Promise.resolve({data:responses[table],error:null}).then(ok,bad)};for(const method of ['select','eq','order','limit','maybeSingle'])q[method]=()=>q;return q;};
 const doubles={react:{useState:fn=>[typeof fn==='function'?fn():fn,()=>{}],useEffect:()=>{},useCallback:fn=>fn},'@/hooks/useAuthReady':{useAuthReady:()=>({isReady:true,user:{id:state.user}})},'@/integrations/supabase/client':{supabase:{from:chain}},'@/lib/persist-cache':{readCache:()=>persisted,writeCache:(key,value)=>state.writes.push({key,value})},'@/lib/subscription.functions':{getClinicSubscription:async()=>{state.calls++;if(state.defer)await new Promise(r=>state.pending.push(r));if(state.fail)throw new Error('Offline');return {organization_id:'org',features:['staff_management'],role:'owner',can_read:true,can_write:true,effective_state:'trialing'};}}};
 const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/hooks/useOrganization.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const timers=new Set();
 new Function('require','module','exports','setTimeout','clearTimeout','Date','console',code+';module.exports.loadShared=loadShared;')(id=>doubles[id]??require(id),m,m.exports,(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();timers.add(t);return t;},clearTimeout,{now:()=>state.now},{error:()=>{}});
 return {...m.exports,state,close:()=>timers.forEach(clearTimeout)};
}
const legacy={org:{id:'org'},role:'owner',entitlement:{can_read:true,can_write:true},authorityError:null,installedModuleIds:['attendance'],planModuleIds:['attendance'],unavailableModuleIds:[],isSubscriptionExpired:false};
const denied=ctx=>{assert.equal(ctx.entitlement,null,'Unverified cached grants cannot authorize writes');assert.equal(ctx.role,null);assert.deepEqual(ctx.planModuleIds,[]);};
test('seven-day persisted owner snapshot is metadata only and always verifies live authority',async()=>{
 const h=harness(legacy);try {denied(h.useOrganization());const result=await h.loadShared('owner');assert.equal(h.state.calls,1);assert.equal(result.entitlement.can_write,true);assert.equal(result.authorityUserId,'owner');assert.deepEqual(h.state.writes[0].value,{org:{id:'org'}},'Persist metadata, never authority');}finally{h.close();}
});
test('failed freshness revokes cached write/manage grants and does not renew persisted age',async()=>{
 const h=harness(legacy);try {await h.loadShared('owner',true);const before=h.state.writes.length;h.state.fail=true;const result=await h.loadShared('owner',true);denied(result);assert.match(result.authorityError,/verified/);assert.equal(h.state.writes.length,before);h.state.fail=false;await h.loadShared('owner');assert.equal(h.state.calls,3,'A failed verification must not get a fresh TTL');}finally{h.close();}
});
test('mounting another persisted caller cannot rebind an in-flight verification',async()=>{
 const h=harness(legacy);let first,next;try {h.state.defer=true;first=h.loadShared('owner');while(!h.state.pending.length)await new Promise(setImmediate);h.state.user='other';denied(h.useOrganization());next=h.loadShared('other');for(let i=0;i<5;i++)await new Promise(setImmediate);assert.equal(h.state.calls,2,'New subscriber render must not rebind shared ownership without advancing generation');}finally{h.state.pending.splice(0).forEach(r=>r());await Promise.all([first,next]);h.close();}
});
test('expired live authority is revoked while revalidation is pending',async()=>{
 const h=harness();try {await h.loadShared('owner');h.state.now+=60001;h.state.defer=true;const next=h.loadShared('owner');denied(h.useOrganization());while(!h.state.pending.length)await new Promise(setImmediate);h.state.pending.shift()();await next;assert.equal(h.useOrganization().entitlement.can_write,true);}finally{h.close();}
});
