const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const zod = require(path.join(root, 'node_modules/zod'));
const sliceIndex = process.argv.indexOf('--slice');
const slice = sliceIndex < 0 ? 'all' : process.argv[sliceIndex + 1];
const A='00000000-0000-4000-8000-00000000000a', B='00000000-0000-4000-8000-00000000000b', U='00000000-0000-4000-8000-000000000001';
let writes=[], noMembership=false, missingUpdate=false;
const rows = {
  organization_members:[{organization_id:A,user_id:U,role:'owner'}],
  clinics:[{id:A,organization_id:A},{id:B,organization_id:B}],
  expenses:[{id:A,organization_id:A,clinic_id:A,created_by:U,title:'Synthetic A',amount:10},{id:B,organization_id:B,clinic_id:B,title:'Synthetic B',amount:100}],
};
function client(admin=false) { return {from(table) {
  let filters=[], action='select', payload=null;
  const q={select(){return q},eq(k,v){filters.push([k,v]);return q},limit(){return q},order(){return q},update(p){action='update';payload=p;return q},insert(p){action='insert';payload=p;return q},upsert(p){action='insert';payload=p;return q},delete(){action='delete';return q},maybeSingle(){return run(true)},single(){return run(true)},then(a,b){return run(false).then(a,b)}};
  function run(single) {
    let found=(noMembership&&table==='organization_members'?[]:rows[table]||[]).filter(r=>filters.every(([k,v])=>r[k]===v)).filter(r=>admin||!r.organization_id||r.organization_id===A);
    if (missingUpdate && action==='update' && table==='expenses') found=[];
    if(action==='insert') found=[{id:A,...payload}];
    if(action!=='select') writes.push({table,action,filters,payload,affected:found.length,admin});
    return Promise.resolve({data:single?found[0]||null:found,error:null});
  }
  return q;
}}; }
const admin=client(true),session=client();
function builder(){let validate;return {middleware(){return this},validator(v){validate=v;return this},handler(fn){return args=>fn({...args,data:validate?validate(args.data):args.data})}}}
function load(rel) {
  const code=ts.transpileModule(fs.readFileSync(path.join(root,rel),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const sandbox={exports:{},console,Request,Response,URL,Date,Set,Map,Object,require(name){
    if(name==='@tanstack/react-start') return {createServerFn:builder};
    if(name==='zod') return zod;
    if(name.includes('auth-middleware')) return {requireSupabaseAuth:{}};
    if(name.includes('client.server')) return {supabaseAdmin:admin};
    if(name==='./finance.server') return {vendorKey:s=>s.toLowerCase()};
    if(name==='@/lib/tenant') return tenant;
    throw new Error('Unstubbed import '+name);
  }};
  vm.runInNewContext(code,sandbox,{filename:rel});return sandbox.exports;
}
const tenant=load('src/lib/tenant.ts'),middleware=load('src/middleware/tenant.middleware.ts'),finance=load('src/lib/finance.functions.ts');
const results=[];
async function test(group,name,fn) {
  if(slice!=='all'&&slice!==group)return;
  writes=[];noMembership=false;missingUpdate=false;
  try {await fn();results.push({test:name,result:'PASS'});}catch(e){results.push({test:name,result:'FAIL',detail:e.message});}
}
function ok(value,msg){if(!value)throw new Error(msg)}
async function denied(fn,pattern){let error;try{await fn()}catch(e){error=e}ok(error&&(!pattern||pattern.test(error.message)), 'Expected denial, got '+(error?.message||'success'));}
const ctx={supabase:session,userId:U};
const req=headers=>new Request('https://synthetic.invalid',{headers});
const payload={id:B,organizationId:A,clinicId:A,title:'Synthetic edit',amount:1,gstAmount:0,category:'Other',categorySource:'manual',paymentMode:'cash',date:'2030-01-01'};
(async()=>{
  await test('tenant','forged tenant headers denied',async()=>{
    await denied(()=>middleware.withTenantContext(req({'x-organization-id':B,'x-clinic-id':B}),ctx,{organizationId:A,clinicId:A}));
  });
  await test('tenant','member resolves frozen tenant from verified membership and clinic',async()=>{
    const got=await middleware.withTenantContext(req({}),ctx,{organizationId:A,clinicId:A});
    ok(got.organizationId===A&&got.clinicId===A&&got.userId===U&&Object.isFrozen(got),'Invalid or mutable tenant');
  });
  await test('tenant','missing membership denied',async()=>{noMembership=true;await denied(()=>middleware.withTenantContext(req({}),ctx,{organizationId:A,clinicId:A}));});
  await test('tenant','foreign clinic denied',async()=>{await denied(()=>middleware.withTenantContext(req({}),ctx,{organizationId:A,clinicId:B}));});
  await test('tenant','malformed tenant denied',async()=>{await denied(()=>tenant.assertTenantScope({organizationId:'not-a-uuid'}));});
  await test('expense','expense IDOR denied without audit leakage',async()=>{await denied(()=>finance.saveExpense({data:payload,context:ctx}),/Expense not found/);ok(writes.length===0,'Unexpected write');});
  await test('expense','foreign expense clinic denied',async()=>{await denied(()=>finance.saveExpense({data:{...payload,id:A,clinicId:B},context:ctx}),/Clinic not found/);ok(writes.length===0,'Unexpected write');});
  await test('expense','nonmember expense organization denied',async()=>{await denied(()=>finance.saveExpense({data:{...payload,organizationId:B},context:ctx}),/Unauthorized/);ok(writes.length===0,'Unexpected write');});
  await test('expense','authorized expense update preserves tenant and creator',async()=>{
    const result=await finance.saveExpense({data:{...payload,id:A},context:ctx});const w=writes.find(w=>w.table==='expenses');
    ok(result.id===A&&w?.affected===1,'Update missing');
    ok(w.filters.some(([k,v])=>k==='organization_id'&&v===A),'Mutation lacks org predicate');
    ok(!('organization_id' in w.payload)&&!('created_by' in w.payload),'Edit overwrites ownership');
    ok(writes.some(w=>w.table==='finance_audit'&&w.payload.before_data.organization_id===A),'Missing own audit');
  });
  await test('expense','missing expense update target denied',async()=>{missingUpdate=true;await denied(()=>finance.saveExpense({data:{...payload,id:A},context:ctx}),/Expense not found/);ok(!writes.some(w=>w.table==='finance_audit'),'Audit created for absent target');});
  await test('expense','authorized expense create succeeds',async()=>{const {id,...create}=payload;const got=await finance.saveExpense({data:create,context:ctx});ok(got.id===A&&writes.some(w=>w.table==='expenses'&&w.payload.organization_id===A),'Create failed');});
  await test('expense','expense delete IDOR denied',async()=>{await denied(()=>finance.deleteExpense({data:{id:B,organizationId:A},context:ctx}),/Expense not found/);ok(writes.length===0,'Unexpected delete');});
  for (const rpcError of [false,true]) {
    await test('invite',rpcError?'invite acceptance RPC rejection has no follow-up writes':'invite page accepts through atomic token RPC only',async()=>{
      const source=fs.readFileSync(path.join(root,'src/routes/invite.$token.tsx'),'utf8');
      const tree=ts.createSourceFile('invite.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      let accept;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='accept')accept=n;ts.forEachChild(n,visit)}visit(tree);
      ok(accept,'Missing accept handler');
      const calls=[],nav=[];
      const base=client();
      const sandbox={exports:{},invite:{id:B,organization_id:B,email:'synthetic@example.invalid',role:'staff',organization:{name:'Synthetic B'}},user:{id:U,email:'synthetic@example.invalid'},token:'SYNTHETIC_TOKEN',np:false,
        setAccepting(){},toast:{error(){},success(){}},navigate(n){nav.push(n)},supabase:{
          from(table){calls.push({table});return base.from(table)},
          async rpc(name,payload){calls.push({name,payload});return {data:rpcError?null:B,error:rpcError?{message:'Invalid invite'}:null}},
        }};
      const code=ts.transpileModule(accept.getText(tree)+'\nexports.accept=accept;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
      vm.runInNewContext(code,sandbox);await sandbox.exports.accept();
      ok(calls[0]?.name==='accept_invite'&&calls[0]?.payload._token==='SYNTHETIC_TOKEN','Missing token-only authority');
      ok(Object.keys(calls[0].payload).length===1,'Client supplied role/org to accept authority');
      ok(!calls.some(c=>c.table==='organization_members'||c.table==='organization_invites'),'Direct membership/invite writes');
      ok(rpcError?calls.length===1&&nav.length===0:nav.length===1,'Incorrect acceptance follow-up');
    });
  }
  const summary={total:results.length,pass:results.filter(r=>r.result==='PASS').length,fail:results.filter(r=>r.result==='FAIL').length};
  const output={environment:'Actual TS source bodies; mocked TanStack registration/session middleware/Supabase adapter; NOT HTTP/Auth/PostgREST integration. No provider/network transport.',results,summary};
  const out=process.argv.indexOf('--output');if(out>=0)fs.writeFileSync(process.argv[out+1],JSON.stringify(output,null,2));
  console.log(JSON.stringify(output,null,2));process.exitCode=summary.fail||!summary.total?1:0;
})();
