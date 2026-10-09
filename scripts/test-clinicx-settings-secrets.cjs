// Real server function bodies; provider and auth/DB transport are isolated doubles.
// Uses synthetic strings only. Does not validate hosted JWT cryptography or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
function compile(text, filename, requireFn, globals={}) {
  const module = {exports:{}};
  const code = ts.transpileModule(text, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code, {exports:module.exports,module,require:requireFn,...globals}, {filename});
  return module.exports;
}
function harness({role='super_admin',rows=[],dbError=null}={}) {
  let writes=[], fetches=[], readQueries=[];
  const sb={from(table) { assert.equal(table,'system_settings'); const q={select(){readQueries.push('select');return q},in(k,values){readQueries.push([...values]);return q},then(resolve,reject){return Promise.resolve({data:rows,error:dbError}).then(resolve,reject)},upsert:async row=>{writes.push(row);return {error:dbError}}};return q;}};
  const text=fs.readFileSync(path.join(ROOT,'src/lib/admin.server.ts'),'utf8');
  const tree=ts.createSourceFile('admin.server.ts',text,ts.ScriptTarget.Latest,true);
  const names=new Set(['getSystemSettingsImpl','saveSystemSettingsImpl','testIntegrationImpl']);
  let parts=[];
  for(const n of tree.statements) {
    if(ts.isImportDeclaration(n)&&n.moduleSpecifier.text==='./settings-secrets.server')parts.push(n.getText(tree));
    if(ts.isFunctionDeclaration(n)&&names.has(n.name?.text))parts.push(n.getText(tree));
  }
  const load=name=> {
    if(name==='@/integrations/supabase/client.server')return {supabaseAdmin:sb};
    if(name==='./settings-secrets.server')return compile(fs.readFileSync(path.join(ROOT,'src/lib/settings-secrets.server.ts'),'utf8'),name,()=>{throw Error('Unexpected helper import')});
    throw Error('Unstubbed transport/import '+name);
  };
  const functions=compile(parts.join('\n'), 'actual-admin-settings.ts',load,{
    getVerifiedAdmin:async()=>role?{id:'synthetic-admin',role}:null,
    createAuditLog:async()=>{},
    process:{env:{}},Buffer,URL,
    fetch:async(url,options)=>{fetches.push({url,options});return {ok:true,status:200}},
  });
  return {functions,writes,fetches,readQueries};
}

test('saved provider credentials never return to the admin browser',async()=>{
  const h=harness({rows:[{key:'platform_name',value:'ClinicX'},{key:'openai_api_key',value:'SYNTHETIC_PRIVATE_CREDENTIAL'},{key:'razorpay_key_secret',value:'SYNTHETIC_SECRET'}]});
  const result=await h.functions.getSystemSettingsImpl();
  assert.equal(result.platform_name,'ClinicX');
  assert.equal(result.openai_api_key,'');
  assert.equal(result.razorpay_key_secret,'');
  assert.equal(JSON.stringify(result).includes('SYNTHETIC_'),false);
  assert.equal(result.__configured_openai_api_key,'true');
});

test('failed settings read never presents defaults as saved configuration',async()=>{
  const h=harness({dbError:{message:'Synthetic DB unavailable'}});
  await assert.rejects(h.functions.getSystemSettingsImpl(), /System settings unavailable/);
});

test('support cannot read global system credentials or settings',async()=>{
  const h=harness({role:'support'});
  await assert.rejects(h.functions.getSystemSettingsImpl(), /Super Admin/);
  assert.equal(h.readQueries.length,0);
});

test('blank secret fields preserve saved credentials and omit read metadata',async()=>{
  const h=harness();
  await h.functions.saveSystemSettingsImpl({openai_api_key:'',razorpay_key_secret:'   ',platform_name:'ClinicX',__configured_openai_api_key:'true'});
  assert.deepEqual(h.writes.map(r=>r.key),['platform_name']);
});

test('explicit nonempty secret replacement remains permitted for super admin',async()=>{
  const h=harness();await h.functions.saveSystemSettingsImpl({openai_api_key:'SYNTHETIC_REPLACEMENT'});
  assert.equal(h.writes[0].value,'SYNTHETIC_REPLACEMENT');
});

test('integration test resolves saved secret on server when browser field is blank',async()=>{
  const h=harness({rows:[{key:'openai_api_key',value:'SYNTHETIC_SAVED_TOKEN'}]});
  const result=await h.functions.testIntegrationImpl({provider:'openai',settings:{openai_api_key:''}});
  assert.equal(result.ok,true);
  assert.equal(h.fetches.length,1);
  assert.equal(h.fetches[0].options.headers.Authorization,'Bearer SYNTHETIC_SAVED_TOKEN');
  assert.equal(JSON.stringify(result).includes('SYNTHETIC'),false);
});
