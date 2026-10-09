const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
function load(file,doubles={}) {
  assert.ok(fs.existsSync(path.join(root,file)), `${file} must exist`);
  const m={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',code)(name=>doubles[name]??require(name),m,m.exports);
  return m.exports;
}
const org='11111111-1111-4111-8111-111111111111';
const staff='user:22222222-2222-4222-8222-222222222222';
const row={id:org,organization_id:org,clinic_id:null,staff_id:staff,staff_name:'=SUM(1,2)',staff_role:'staff',attendance_date:'2026-10-09',status:'present',check_in:'2026-10-09T04:00:00Z',check_out:null,shift:'morning',working_hours:0,notes:'one,"two"\nthree',created_at:'2026-10-09T04:00:00Z',updated_at:'2026-10-09T04:00:00Z'};
const snapshot={organization_id:org,date:'2026-10-09',today:'2026-10-09',server_now:'2026-10-09T04:00:00Z',timezone:'Asia/Kolkata',can_manage:false,can_write:true,self_id:staff,roster:[{staff_id:staff,staff_name:row.staff_name,staff_role:'staff',clinic_id:null}],records:[row],open_records:[row]};
test('typed attendance service calls caller-token RPC and validates tenant response',async()=>{
 const {readAttendance,recordAttendance}=load('src/lib/attendance.service.ts');
 const calls=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='clinicx_attendance_day'?snapshot:row,error:null};}};
 const result=await readAttendance(client,{organizationId:org,date:'2026-10-09'});
 assert.equal(result.records[0].staff_id,staff);
 await recordAttendance(client,{organizationId:org,action:'check_in'});
 assert.deepEqual(calls[0],{name:'clinicx_attendance_day',args:{p_org:org,p_date:'2026-10-09',p_clinic:null}});
 assert.deepEqual(calls[1],{name:'clinicx_attendance_record',args:{p_org:org,p_subject:null,p_action:'check_in',p_date:null,p_status:null,p_shift:'morning',p_notes:null}});
 await assert.rejects(()=>readAttendance({rpc:async()=>({data:{...snapshot,organization_id:staff},error:null})},{organizationId:org}),/tenant|uuid/i);
 await assert.rejects(()=>readAttendance({rpc:async()=>({data:{...snapshot,date:'2026-10-08'},error:null})},{organizationId:org,date:'2026-10-09'}),/date/i);
});
test('saved legacy attendance stays readable without allowing legacy IDs as new subjects',async()=>{
 const {readAttendance,attendanceWriteInput}=load('src/lib/attendance.service.ts');
 const historical={...row,staff_id:'legacy-import-id'};
 const result=await readAttendance({rpc:async()=>({data:{...snapshot,records:[historical],open_records:[]},error:null})},{organizationId:org});
 assert.equal(result.records[0].staff_id,'legacy-import-id');
 assert.equal(attendanceWriteInput.safeParse({organizationId:org,subject:'legacy-import-id',action:'check_in'}).success,false);
});
test('CSV includes historical records and escapes formulas and quotes',()=>{
 const {attendanceCsv}=load('src/lib/attendance-ui.ts');
 const csv=attendanceCsv(snapshot);
 assert.ok(csv.includes('staff_id')); assert.ok(csv.includes('"\'=SUM(1,2)"'));
 assert.ok(csv.includes('"one,""two""\nthree"')); assert.equal(csv.includes('undefined'),false);
 assert.ok(attendanceCsv({...snapshot,roster:[],records:[row]}).includes(staff));
});
test('attendance allows staff self service without granting staff-management administration',()=>{
 const {canAccess}=load('src/lib/subscription-policy.ts');
 const view={can_read:true,can_write:true,role:'staff',features:['staff_management'],limits:{}};
 assert.equal(canAccess(view,'attendance'),true); assert.equal(canAccess(view,'staff'),false);
 assert.equal(canAccess({...view,can_write:false},'attendance'),false);
});
test('attendance server functions use verified caller client and strict inputs',async()=>{
 const service=load('src/lib/attendance.service.ts');
 const createServerFn=()=>{let validator;const fn={middleware(list){assert.equal(list.length,1);return fn},inputValidator(fnInput){validator=fnInput;return fn},handler(handler){return async ({data,context})=>handler({data:validator(data),context})}};return fn};
 const fns=load('src/lib/attendance.functions.ts',{'@tanstack/react-start':{createServerFn},'../integrations/supabase/auth-middleware':{requireSupabaseAuth:'jwt'},'./attendance.service':service});
 const context={supabase:{rpc:async()=>({data:snapshot,error:null})}};
 assert.equal((await fns.getAttendanceDay({data:{organizationId:org},context})).organization_id,org);
 await assert.rejects(()=>fns.saveAttendance({data:{organizationId:org,action:'check_in',check_in:'forged'},context}),/unrecognized|server/i);
});
if(process.env.CLINICX_ATTENDANCE_CAPTURE){
 test('real native PostgreSQL payloads traverse the typed attendance service',async()=>{
  const actual=JSON.parse(fs.readFileSync(process.env.CLINICX_ATTENDANCE_CAPTURE,'utf8'));
  const {readAttendance,recordAttendance}=load('src/lib/attendance.service.ts');
  const transport={rpc:async(name)=>({data:name==='clinicx_attendance_day'?actual.day:actual.row,error:null})};
  const day=await readAttendance(transport,{organizationId:actual.day.organization_id,date:actual.day.date});
  const row=await recordAttendance(transport,{organizationId:actual.row.organization_id,subject:actual.row.staff_id,action:'check_out'});
  assert.equal(day.records[0].id,row.id);assert.equal(day.records[0].check_out,row.check_out);
 });
}
test('App Store has installed attendance Open App CTA and authenticated route',()=>{
 const store=fs.readFileSync(path.join(root,'src/routes/_authenticated/dashboard.modules.tsx'),'utf8');
 assert.match(store,/attendance/); assert.match(store,/Open App/); assert.match(store,/\/dashboard\/attendance/);
 assert.ok(fs.existsSync(path.join(root,'src/routes/_authenticated/dashboard.attendance.tsx')));
 const tree=fs.readFileSync(path.join(root,'src/routeTree.gen.ts'),'utf8');
 assert.ok(tree.includes('/dashboard/attendance'),'Generated tree must register Attendance');
 assert.ok(tree.includes('config: Awaited<ReturnType<typeof startInstance.getOptions>>'),'Preserve TanStack Start footer');
});
