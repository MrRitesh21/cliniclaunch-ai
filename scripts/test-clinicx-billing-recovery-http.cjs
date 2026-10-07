// Unit HTTP boundary RED/GREEN. No network, credentials or project bootstrap.
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {handleBillingJobs}=require('../src/lib/billing-webhook.server.ts');
(async()=>{
 assert.equal(typeof handleBillingJobs,'function','billing reconciliation needs a runnable authenticated HTTP boundary');
 let calls=0;const deps={cronKey:'fixture-only',run:async()=>{calls++;return {processed:1,retry_scheduled:0,commands_recovered:0,commands_pending:0};}};
 for(const headers of [{},{'x-cron-key':'wrong'}])assert.equal((await handleBillingJobs(new Request('http://local/api/internal/clinicx-billing-jobs',{method:'POST',headers}),deps)).status,401);
 assert.equal(calls,0,'unauthorized requests must not load admin/provider');
 const ok=await handleBillingJobs(new Request('http://local/api/internal/clinicx-billing-jobs',{method:'POST',headers:{'x-cron-key':'fixture-only'}}),deps);assert.equal(ok.status,200);assert.equal(calls,1);
 assert.equal((await handleBillingJobs(new Request('http://local',{headers:{'x-cron-key':'fixture-only'}}),deps)).status,405);
 const failed=await handleBillingJobs(new Request('http://local',{method:'POST',headers:{'x-cron-key':'fixture-only'}}),{...deps,run:async()=>{throw Error('fixture config absent');}});assert.equal(failed.status,503);assert.equal((await failed.json()).ok,false);
 console.log('PASS HTTP auth, POST-only, deferred authority, configuration failure not success');
})().catch(e=>{console.error(e);process.exitCode=1;});
