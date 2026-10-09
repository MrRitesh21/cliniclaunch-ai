// Offline contracts: real local modules; no app bootstrap or provider transport.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(relative, doubles = {}, extra = '') {
  const full = path.join(root, relative);
  const key = full + extra;
  if (!Object.keys(doubles).length && cache.has(key)) return cache.get(key);
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = name => Object.hasOwn(doubles, name) ? doubles[name] : name.startsWith('./') ? load(path.relative(root, path.resolve(path.dirname(full), name + '.ts')), doubles) : require(name);
  new Function('require','module','exports', code + '\n' + extra)(localRequire,m,m.exports);
  if (!Object.keys(doubles).length) cache.set(key,m.exports);
  return m.exports;
}
module.exports = { load, root };
function serverFn() {
  let parse = input => input;
  const chain = {validator(fn){parse=fn;return chain;}, middleware(){return chain;},handler(fn){const run = input => fn({...input,data:parse(input.data)});run.parse=parse;return run;}};
  return chain;
}
// A context fixture is passed through a require boundary to avoid any environment credentials.
function makeClinic(sb) {
  const transport = { '@tanstack/react-start':{createServerFn:serverFn}, '@supabase/supabase-js':{createClient:()=>sb}, '@/integrations/supabase/auth-middleware':{requireSupabaseAuth:{}}, './redis':{redisCache:{get:async()=>null,set:async()=>{},flushPattern:async()=>{}}}, './scale.server':{enforcePolicy:async()=>{},callerIp:async()=> 'fixture-ip'}, './notify.server':{notifyClinicEvent:async()=>{}}, './push.functions':{}, 'fixture-sb':sb };
  return load('src/lib/clinic.functions.ts',transport,';adminClient = async () => require("fixture-sb");');
}
const clinicId = '11111111-1111-4111-8111-111111111111';
const doctorId = '22222222-2222-4222-8222-222222222222';
const bookingInput = {clinic_id:clinicId,patient_name:'Care Patient',patient_phone:'9876543210',patient_email:'',patient_age:null,patient_gender:null,problem:'Checkup',scheduled_at:'2026-10-01T10:00:00.000Z',source:'booking'};
function fixtureDb({published=true,suspended=null,doctorOrg='org-a',active=true,clinicError=false}={}) {
  const writes=[]; const reads=[];
  const tables={clinics:[{id:clinicId,organization_id:'org-a',is_published:published,suspended_at:suspended,clinic_name:'Care'}],doctors:[{id:doctorId,organization_id:doctorOrg,clinic_id:null,is_active:active}]};
  return {writes,reads,from(table){
    const filters=[];let payload=null;let single=false;let selection='';
    const result=()=> {reads.push({table,filters:[...filters],selection});if(payload){writes.push({table,payload});return {data:{id:'fixture-appointment',scheduled_at:bookingInput.scheduled_at},error:null};}let rows=tables[table]??[];for(const [op,key,value] of filters){if(op==='eq'||op==='is')rows=rows.filter(r=>r[key]===value);if(op==='neq')rows=rows.filter(r=>r[key]!==value);}return {data:single?(rows[0]??null):rows,error:clinicError&&table==='clinics'?{message:'synthetic lookup error'}:null,count:rows.length};};
    const chain={select(s){selection=s;return chain;},eq(k,v){filters.push(['eq',k,v]);return chain;},is(k,v){filters.push(['is',k,v]);return chain;},neq(k,v){filters.push(['neq',k,v]);return chain;},gte(){return chain;},lte(){return chain;},order(){return chain;},limit(){return chain;},insert(p){payload=p;return chain;},upsert(p){payload=p;return chain;},maybeSingle(){single=true;return chain;},single(){single=true;return chain;},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}};
    return chain;
  }};
}
test('public booking rejects unpublished/suspended clinics and foreign/inactive doctors before writes', async()=> {
  for(const options of [{published:false},{suspended:'2026-10-01'}, {doctorOrg:'org-b'}, {active:false},{clinicError:true}]){
    const sb=fixtureDb(options);const booking=makeClinic(sb).createBooking;
    await assert.rejects(booking({data:{...bookingInput,doctor_id:doctorId}}));assert.equal(sb.writes.length,0);
  }
  const sb=fixtureDb();const result=await makeClinic(sb).createBooking({data:{...bookingInput,doctor_id:doctorId}});
  assert.equal(result.id,'fixture-appointment');assert.equal(sb.writes.find(w=>w.table==='appointments').payload.patient_phone,'+919876543210');
});
test('clinic lead writes require an existing published non-suspended clinic', async()=> {
  for(const published of [false,true]){
    const sb=fixtureDb({published});const leads=load('src/lib/leads.ts',{'@/integrations/supabase/client':{supabase:{}},'@tanstack/react-start':{createServerFn:serverFn},'./clinic.functions':{adminClient:async()=>sb,requirePublishedClinic:makeClinic(sb).requirePublishedClinic},'./scale.server':{enforcePolicy:async()=>{},callerIp:async()=> 'fixture-ip'},'./notify.server':{notifyClinicEvent:async()=>{}}});
    const call=leads.submitLeadServer({data:{clinic_id:clinicId,name:'Care',phone:'9876543210'}});
    if(published){await call; assert.equal(sb.writes.filter(w=>w.table==='leads').length,1);}else {await assert.rejects(call);assert.equal(sb.writes.length,0);}
  }
});
test('booking input rejects malformed phones and calendar timestamps before handler work', () => {
  const booking = makeClinic({from:()=>assert.fail('validation must precede database')}).createBooking;
  for (const phone of ['abcde','12345','98765x43210','++919876543210']) assert.throws(()=>booking.parse({...bookingInput,patient_phone:phone}));
  for (const time of ['not a date','2026-02-30T10:00:00Z','2026-10-01','2026-10-01T25:00:00Z']) assert.throws(()=>booking.parse({...bookingInput,scheduled_at:time}));
  for (const phone of ['9876543210','+91 98765 43210','0919876543210','09876543210','919876543210']) assert.equal(booking.parse({...bookingInput,patient_phone:phone}).patient_phone,'+919876543210');
  assert.equal(booking.parse({...bookingInput,patient_phone:'+44 20 7946 0958'}).patient_phone,'+442079460958');
  assert.equal(booking.parse({...bookingInput,source:'walkin'}).source,'walkin'); // No invented future-only rule.
});
test('lead forms normalize phones and reject control-only names without changing React text', () => {
  const leads=load('src/lib/leads.ts',{'@/integrations/supabase/client':{supabase:{}},'@tanstack/react-start':{createServerFn:serverFn},'./clinic.functions':{adminClient:async()=>({})}});
  assert.throws(()=>leads.leadSchema.parse({clinic_id:clinicId,name:'Care',phone:'abcde'}));
  assert.throws(()=>leads.demoLeadSchema.parse({name:'\u0000',phone:'9876543210',email:'care@example.invalid'}));
  const parsed=leads.leadSchema.parse({clinic_id:clinicId,name:'Care <b>Patient</b>',phone:'09876543210'});
  assert.equal(parsed.name,'Care <b>Patient</b>'); assert.equal(parsed.phone,'+919876543210');
});
test('print construction escapes titles and cells and sanitizes trusted formatting', () => {
  const finance = load('src/lib/finance-format.ts');
  let written = ''; const oldWindow = global.window; const oldTimeout = global.setTimeout;
  global.window = {open: () => ({document:{write: html => written = html,close(){}}, focus(){},print(){}})};
  global.setTimeout = () => 0;
  try {
    const table = finance.tableHtml(['<img src=x onerror=alert(1)>'], [['<script>bad</script>',123]]);
    assert.match(table, /&lt;img/); assert.match(table, /&lt;script/);
    finance.printReport('</title><script>bad</script>', '<div style="font-size:13px"><strong>Summary</strong></div>' + table + '<img src=x onerror=alert(1)><script>bad</script>');
    assert.doesNotMatch(written, /<script|<[^>]+onerror=/); assert.match(written, /<strong>Summary<\/strong>/); assert.match(written, /font-size:13px/);
  } finally {global.window=oldWindow; global.setTimeout=oldTimeout;}
});
test('CSV string formulas and formula headers are neutralized, numeric negatives preserved', () => {
  const finance = load('src/lib/finance-format.ts');
  const blobs = []; const oldDoc = global.document; const oldURL = global.URL;
  global.document = {createElement: () => ({click(){}})};
  global.URL = {createObjectURL: blob => {blobs.push(blob);return 'blob:test';},revokeObjectURL(){}};
  try {finance.downloadCsv('report',[{'=BAD':' \t=HYPERLINK("x")',normal:-12,quoted:'a,b\rc'}]);} finally {global.document=oldDoc; global.URL=oldURL;}
  return blobs[0].text().then(csv => {assert.match(csv,/^'=BAD,/); assert.match(csv,/"' \t=HYPERLINK/); assert.match(csv,/,-12,/);assert.match(csv,/"a,b\rc"/);});
});
test('production error pages hide message and stack; explicit development debug escapes text', () => {
  const {renderErrorPage} = load('src/lib/error-page.ts');
  const error = new Error('SYNTHETIC_PRIVATE_SENTINEL <img src=x onerror=alert(1)>');
  const html = renderErrorPage(error);
  assert.doesNotMatch(html, /SYNTHETIC_PRIVATE_SENTINEL|at TestContext|<pre>/); assert.match(html,/support/i);
  const dev = renderErrorPage(error,{development:true});
  assert.match(dev,/SYNTHETIC_PRIVATE_SENTINEL/); assert.doesNotMatch(dev,/<img/);
});
const templates = load('src/lib/html-template.ts');
test('safe theme placeholders survive parser-based saving in both stylesheets and attributes', () => {
  const css = templates.scopeTemplateCss('.hero{color:{{theme_color}};padding:20px}');
  assert.match(css, /\{\{theme_color\}\}/);
  const html = templates.sanitizeTemplateHtml('<p style="color:{{theme_color}};padding:20px">Hi</p>');
  const rendered = templates.compileCustomTemplate({html_body:html,css_body:css}, {slug:'care',theme_color:'#123456'});
  assert.match(rendered.html, /color:#123456/);
  assert.match(rendered.css, /color:#123456/);
});
test('nested CSS stays scoped, unsafe CSS dropped, save-render remains idempotent', () => {
  const css = templates.scopeTemplateCss('@import url(https://example.invalid/a); @media (min-width:600px){@supports(display:grid){body{color:red} .hero{display:grid;background:url(https://example.invalid/x);padding:20px}}} .clinic-custom-template + #outside{color:red} @font-face{src:url(https://example.invalid/f)} .hero{position:fixed; color: blue}');
  assert.doesNotMatch(css, /url|import|font-face|position|#outside/);
  assert.match(css, /clinic-custom-template.*hero/);
  assert.match(css, /padding:20px/);
  assert.equal(templates.scopeTemplateCss(css), css);
});
test('save then render preserves URL/style and rich tokens without CSS token injection', () => {
  const saved = templates.sanitizeTemplateHtml('<section class="hero" style="color:{{theme_color}};padding:20px"><h1>{{clinic_name}}</h1><a href="{{book_url}}">Book</a>{{services_html}}{{gallery_html}}</section>');
  const result = templates.compileCustomTemplate({html_body:saved,css_body:'.hero{color:{{theme_color}}}'}, {slug:'care',clinic_name:'Care <script>bad</script>',theme_color:'red;} body{color:red} /*',services:[{name:'Checkup',description:'Safe <b>text</b>'}],gallery:['javascript:alert(1)','https://example.invalid/photo.png']});
  assert.match(result.html, /href="\/c\/care\/book"/);
  assert.match(result.html, /ct-service/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.doesNotMatch(result.html, /src="javascript/);
  assert.doesNotMatch(result.css, /body|\/\*/);
});
test('parser allowlist rejects entity-obfuscated active URLs and forms, preserves layout', () => {
  const html = templates.sanitizeTemplateHtml('<section class="hero"><h1>Clinic &amp; Care</h1><!-- comment --><a href="jav&#x61;script:alert(1)">bad</a><a href="https://example.invalid/help">help</a><img src="data:image/svg+xml,x" onerror="alert(1)"><form action="https://example.invalid"><input name="password"></form><svg><a xlink:href="javascript:alert(1)">x</a></svg></section>');
  assert.doesNotMatch(html, /javascript|onerror|data:|<form|<input|<svg|comment/);
  assert.match(html, /<section class="hero"><h1>Clinic &amp; Care<\/h1>/);
  assert.match(html, /href="https:\/\/example.invalid\/help"/);
});
