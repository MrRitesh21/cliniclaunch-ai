#!/usr/bin/env node
// ⚡ 1-Click Complete Clinic Website & Workspace Setup — offline contract tests.
// Modules run in VM contexts with Supabase / Baileys / AI transport replaced by fixtures.
// Verifies the full workflow: CRM one-click setup, AI outreach auto-generation,
// idempotency, slug uniqueness, specialty profiles, and the WhatsApp reply pipeline.
// Assertions never echo credential values, source lines, or command output.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const CRM_SOURCE = fs.readFileSync(path.join(root, "src/lib/crm.server.ts"), "utf8");
const SHARED_SOURCE = fs.readFileSync(path.join(root, "src/lib/crm.shared.ts"), "utf8");
const AI_SOURCE = fs.readFileSync(path.join(root, "src/lib/platform-ai-agent.server.ts"), "utf8");

const APP_URL = "https://clinicx.digiwil.com";

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

const silentConsole = { log() {}, warn() {}, error() {}, info() {} };

/**
 * Chainable Supabase admin double. Records every query state and resolves
 * through the provided behavior resolver. No network, no real credentials.
 */
function makeSupabaseAdmin(resolve) {
  const calls = [];
  const admin = {
    calls,
    from(table) {
      const state = { table, op: null, cols: null, filters: [], rows: null, patch: null };
      const chain = {
        select(cols) {
          if (state.op === null) state.op = "select";
          state.cols = cols || null;
          return chain;
        },
        insert(rows) {
          state.op = "insert";
          state.rows = Array.isArray(rows) ? rows : [rows];
          return chain;
        },
        update(patch) {
          state.op = "update";
          state.patch = patch;
          return chain;
        },
        upsert(rows) {
          state.op = "upsert";
          state.rows = Array.isArray(rows) ? rows : [rows];
          return chain;
        },
        eq(col, val) {
          state.filters.push({ t: "eq", col, val });
          return chain;
        },
        or(expr) {
          state.filters.push({ t: "or", expr });
          return chain;
        },
        ilike(col, val) {
          state.filters.push({ t: "ilike", col, val });
          return chain;
        },
        not() {
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        maybeSingle() {
          calls.push(state);
          return Promise.resolve(resolve(state));
        },
        single() {
          calls.push(state);
          return Promise.resolve(resolve(state));
        },
        then(onFulfilled, onRejected) {
          calls.push(state);
          return Promise.resolve(resolve(state)).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
  };
  return admin;
}

/**
 * Per-test DB behavior. Reads resolve from fixtures; writes always succeed.
 */
function makeResolver(behavior) {
  return function resolve(state) {
    if (state.op === "insert" || state.op === "upsert") {
      (behavior.inserts = behavior.inserts || []).push(state);
      if (state.table === "platform_crm_leads") {
        const row = { ...state.rows[0], id: behavior.nextLeadId || "lead-db-1" };
        behavior.leadsById = behavior.leadsById || {};
        behavior.leadsById[row.id] = row;
        return { data: row, error: null };
      }
      return { data: state.rows, error: null };
    }
    if (state.op === "update") {
      (behavior.updates = behavior.updates || []).push(state);
      return { data: null, error: null };
    }
    // Reads
    const idFilter = state.filters.find((f) => f.t === "eq" && f.col === "id");
    if (state.table === "platform_crm_leads" && idFilter) {
      const lead =
        (behavior.leadsById && behavior.leadsById[idFilter.val]) || behavior.leadFixture || null;
      return { data: lead, error: null };
    }
    if (state.table === "platform_crm_leads") {
      return { data: behavior.leadList || [], error: null };
    }
    if (state.table === "clinics" || state.table === "organizations") {
      const slugFilter = state.filters.find((f) => f.t === "eq" && f.col === "slug");
      if (slugFilter) {
        if (
          state.table === "clinics" &&
          behavior.clinicsBySlug &&
          behavior.clinicsBySlug[slugFilter.val]
        ) {
          return { data: behavior.clinicsBySlug[slugFilter.val], error: null };
        }
        const exists = (behavior.takenSlugs || []).includes(slugFilter.val);
        return { data: exists ? { id: `existing-${state.table}` } : null, error: null };
      }
      return { data: null, error: null };
    }
    if (state.table === "system_settings") {
      return { data: behavior.settingsRow || null, error: null };
    }
    return { data: null, error: null };
  };
}

function loadCrmShared() {
  const moduleExports = {};
  vm.runInNewContext(transpile(SHARED_SOURCE), {
    exports: moduleExports,
    require() {
      throw new Error("Unreviewed import blocked");
    },
    console: silentConsole,
  });
  return moduleExports;
}

const SHARED = loadCrmShared();

function loadCrmServer(behavior) {
  const sb = makeSupabaseAdmin(makeResolver(behavior));
  const moduleExports = {};
  const requireHook = (name) => {
    if (name === "@/integrations/supabase/client.server") return { supabaseAdmin: sb };
    if (name === "./env.server") return { serverEnv: { APP_URL: APP_URL } };
    if (name === "./baileys.server") return behavior.baileys;
    if (name === "./crm.shared") return SHARED;
    if (name === "./redis") {
      return {
        redisCache: {
          del: async (key) => {
            (behavior.redisDels = behavior.redisDels || []).push(key);
          },
        },
      };
    }
    if (name === "zod") return require("zod");
    throw new Error(`Unreviewed import blocked: ${name}`);
  };
  vm.runInNewContext(transpile(CRM_SOURCE), {
    exports: moduleExports,
    require: requireHook,
    console: silentConsole,
    crypto: require("node:crypto"),
    process: { env: {} },
  });
  return { mod: moduleExports, sb };
}

function freshBehavior(overrides) {
  const behavior = Object.assign(
    {
      baileys: {
        baileysSend: async (session, phone, text) => {
          (behavior.sent = behavior.sent || []).push({ session, phone, text });
          return { ok: true };
        },
        baileysStatus: async () => ({ ok: true, ready: true }),
        PLATFORM_ADMIN_SESSION: "platform-admin",
      },
    },
    overrides || {},
  );
  return behavior;
}

function insertCalls(sb, table) {
  return sb.calls.filter((c) => c.table === table && c.op === "insert");
}

function updateCalls(sb, table) {
  return sb.calls.filter((c) => c.table === table && c.op === "update");
}

// ---------------------------------------------------------------------------
// Pure helpers & specialty content
// ---------------------------------------------------------------------------

test("cleanDoctorName normalizes doctor names safely", () => {
  const { mod } = loadCrmServer(freshBehavior());
  assert.equal(mod.cleanDoctorName("Anil Arora"), "Dr. Anil Arora");
  assert.equal(mod.cleanDoctorName("Dr. Anil Arora"), "Dr. Anil Arora");
  assert.equal(mod.cleanDoctorName("Dr Meera Rao"), "Dr Meera Rao");
  assert.equal(mod.cleanDoctorName("😀 Rahul"), "Dr. Rahul");
  assert.equal(mod.cleanDoctorName(""), "Dr. Partner");
  assert.equal(mod.cleanDoctorName("शिव सदा सहायते"), "Dr. Partner");
  assert.equal(mod.cleanDoctorName("महादेव कृपा"), "Dr. Partner");
});

test("normalizeIndianPhone and isLidPhone handle Indian + LID numbers", () => {
  const { mod } = loadCrmServer(freshBehavior());
  assert.equal(mod.normalizeIndianPhone("9876543210"), "+919876543210");
  assert.equal(mod.normalizeIndianPhone("09876543210"), "+919876543210");
  assert.equal(mod.normalizeIndianPhone("919876543210"), "+919876543210");
  assert.equal(mod.isLidPhone("62152488562936@lid"), true);
  assert.equal(mod.isLidPhone("62152488562936"), true);
  assert.equal(mod.isLidPhone("9876543210"), false);
  // LID phones pass through normalization untouched
  assert.equal(mod.normalizeIndianPhone("62152488562936@lid"), "62152488562936@lid");
});

test("buildDemoUrl produces the public /c/demo fallback link", () => {
  const { mod } = loadCrmServer(freshBehavior());
  const url = mod.buildDemoUrl({
    doctorName: "Dr. Anil Arora",
    clinicName: "Arora Heart Clinic",
    specialty: "Cardiologist",
    city: "Jaipur",
  });
  assert.ok(url.startsWith(`${APP_URL}/c/demo?`), "demo URL must be on the public /c/demo path");
  assert.ok(url.includes("ref=crm"));
  assert.ok(url.includes(encodeURIComponent("Dr. Anil Arora")));
  assert.ok(url.includes(encodeURIComponent("Arora Heart Clinic")));
});

test("getSpecialtyClinicProfile returns clinically rich content for every major specialty", () => {
  const { mod } = loadCrmServer(freshBehavior());
  const specialties = [
    "Dermatologist",
    "Dentist",
    "Cardiologist",
    "Pediatrician",
    "Orthopedic",
    "Gynecologist",
    "General Physician",
  ];
  const firstServices = new Set();
  for (const specialty of specialties) {
    const p = mod.getSpecialtyClinicProfile({
      specialty,
      doctorName: "Dr. Anil Arora",
      clinicName: "Arora Care Clinic",
      city: "Jaipur",
    });
    assert.ok(p.qualification && p.qualification.length > 5, `${specialty}: qualification`);
    assert.ok(p.experience_years >= 5, `${specialty}: experience`);
    assert.ok(p.consultation_fee >= 200, `${specialty}: fee`);
    assert.ok(p.template, `${specialty}: template`);
    assert.ok(
      ["clinic", "doctor", "dentist"].includes(p.business_type),
      `${specialty}: business_type`,
    );
    assert.ok(
      p.hero_headline.includes("Arora") || p.hero_subheadline.includes("Arora"),
      `${specialty}: personalized hero`,
    );
    assert.ok(Array.isArray(p.services) && p.services.length >= 4, `${specialty}: >=4 services`);
    assert.ok(Array.isArray(p.faqs) && p.faqs.length >= 2, `${specialty}: >=2 FAQs`);
    assert.ok(
      Array.isArray(p.sample_reviews) && p.sample_reviews.length >= 2,
      `${specialty}: >=2 reviews`,
    );
    firstServices.add(p.services[0]);
  }
  // Different specialties must not share identical first services
  assert.ok(firstServices.size >= 5, "specialty content must be distinct");
  // Known curated values for dermatology
  const derma = mod.getSpecialtyClinicProfile({
    specialty: "skin specialist",
    doctorName: "Dr. Meera Rao",
    clinicName: "Meera Skin Studio",
    city: "Pune",
  });
  assert.ok(derma.qualification.includes("Dermatology"));
  assert.equal(derma.consultation_fee, 700);
  assert.equal(derma.template, "modern");
  assert.equal(derma.theme_color, "#0ea5e9");
});

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

test("generateUniqueClinicSlug produces clean, collision-free slugs", async () => {
  const behavior = freshBehavior({ takenSlugs: ["sunrise-dental-care-jaipur"] });
  const { mod } = loadCrmServer(behavior);

  const fresh = await mod.generateUniqueClinicSlug("Arora Heart Clinic-Jaipur");
  assert.equal(fresh, "arora-heart-clinic-jaipur");

  const collided = await mod.generateUniqueClinicSlug("Sunrise Dental Care-Jaipur");
  assert.equal(collided, "sunrise-dental-care-jaipur-2");

  const doctorPrefixed = await mod.generateUniqueClinicSlug("Dr. Meera Rao Dental Studio-Pune");
  assert.equal(doctorPrefixed, "dr-meera-rao-dental-studio-pune");

  const tiny = await mod.generateUniqueClinicSlug("A");
  assert.ok(tiny.startsWith("clinic-"), "tiny candidates get a padded unique slug");
});

// ---------------------------------------------------------------------------
// ⚡ setupCompleteClinicFromLeadImpl — the 1-click workflow core
// ---------------------------------------------------------------------------

test("1-click setup provisions the complete clinic workspace from a fresh lead", async () => {
  const behavior = freshBehavior({
    leadFixture: {
      id: "lead-1",
      name: "Dr. Anil Arora",
      phone: "+919876543210",
      email: null,
      clinic_name: "Arora Heart Clinic",
      city: "Jaipur",
      specialty: "Cardiologist",
      source: "manual",
      status: "new",
      custom_demo_url: null,
      has_replied: false,
      followup_count: 0,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  const { mod, sb } = loadCrmServer(behavior);

  const res = await mod.setupCompleteClinicFromLeadImpl({ leadId: "lead-1" });

  // Result contract
  assert.equal(res.ok, true);
  assert.equal(res.isExisting, false);
  assert.equal(res.slug, "arora-heart-clinic-jaipur");
  assert.equal(res.url, `${APP_URL}/c/arora-heart-clinic-jaipur`);
  assert.equal(res.doctorName, "Dr. Anil Arora");
  assert.equal(res.clinicName, "Arora Heart Clinic");
  assert.equal(res.specialty, "Cardiologist");
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert.ok(UUID_RE.test(res.organizationId), "org id must be a UUID");
  assert.ok(UUID_RE.test(res.clinicId), "clinic id must be a UUID");

  // Organization provisioned
  const orgInserts = insertCalls(sb, "organizations");
  assert.equal(orgInserts.length, 1);
  const org = orgInserts[0].rows[0];
  assert.equal(org.id, res.organizationId);
  assert.equal(org.name, "Arora Heart Clinic");
  assert.equal(org.slug, res.slug);
  assert.ok(org.tagline && org.tagline.length > 10, "org tagline uses hero headline");

  // Clinic website published
  const clinicInserts = insertCalls(sb, "clinics");
  assert.equal(clinicInserts.length, 1);
  const clinic = clinicInserts[0].rows[0];
  assert.equal(clinic.id, res.clinicId);
  assert.equal(clinic.organization_id, res.organizationId);
  assert.equal(clinic.slug, res.slug);
  assert.equal(clinic.doctor_name, "Dr. Anil Arora");
  assert.equal(clinic.clinic_name, "Arora Heart Clinic");
  assert.equal(clinic.specialization, "Cardiologist");
  assert.equal(clinic.is_published, true, "website must be live immediately");
  assert.ok(clinic.published_at, "published_at stamped");
  assert.ok(Array.isArray(clinic.services) && clinic.services.length >= 4, "specialty services");
  assert.ok(Array.isArray(clinic.faqs) && clinic.faqs.length >= 2, "specialty FAQs");
  assert.ok(clinic.working_hours && clinic.working_hours.monday, "working hours set");
  assert.ok(clinic.lead_popup && clinic.lead_popup.enabled === true, "lead capture popup enabled");
  assert.ok(clinic.walkin_max_per_slot >= 1, "walk-in token queue configured");
  assert.ok(clinic.medical_registration_no && clinic.medical_registration_no.startsWith("MCI-"));

  // Doctor record linked
  const doctorInserts = insertCalls(sb, "doctors");
  assert.equal(doctorInserts.length, 1);
  const doctor = doctorInserts[0].rows[0];
  assert.equal(doctor.organization_id, res.organizationId);
  assert.equal(doctor.clinic_id, res.clinicId);
  assert.equal(doctor.name, "Dr. Anil Arora");
  assert.equal(doctor.is_active, true);

  // Core modules installed
  const moduleInserts = insertCalls(sb, "organization_modules");
  assert.equal(moduleInserts.length, 1);
  const installed = [...moduleInserts[0].rows.map((r) => r.module_id)].sort();
  assert.deepEqual(
    installed,
    [
      "analytics",
      "appointments",
      "billing",
      "consultation",
      "crm",
      "prescriptions",
      "reviews",
      "website_builder",
      "whatsapp",
    ],
    "all 9 core modules installed for the org",
  );
  assert.ok(
    moduleInserts[0].rows.every((r) => r.organization_id === res.organizationId),
    "modules bound to the new organization",
  );

  // 14-day Growth trial
  const subInserts = insertCalls(sb, "subscriptions");
  assert.equal(subInserts.length, 1);
  const sub = subInserts[0].rows[0];
  assert.equal(sub.organization_id, res.organizationId);
  assert.equal(sub.plan_id, "growth");
  assert.equal(sub.status, "trialing");
  const trialDays =
    (new Date(sub.trial_ends_at).getTime() - new Date(sub.current_period_start).getTime()) /
    86400000;
  assert.ok(
    trialDays >= 13.9 && trialDays <= 14.1,
    `trial must be ~14 days (got ${trialDays.toFixed(2)})`,
  );

  // Verified reviews
  const reviewInserts = insertCalls(sb, "reviews");
  assert.equal(reviewInserts.length, 1);
  assert.ok(reviewInserts[0].rows.length >= 2, "at least 2 seeded reviews");
  assert.ok(
    reviewInserts[0].rows.every((r) => r.status === "approved" && r.clinic_id === res.clinicId),
    "reviews approved and bound to clinic",
  );

  // CRM lead updated with the live URL
  const leadUpdates = updateCalls(sb, "platform_crm_leads").filter(
    (u) => u.patch && u.patch.custom_demo_url,
  );
  assert.equal(leadUpdates.length, 1);
  assert.equal(leadUpdates[0].patch.custom_demo_url, res.url);
  assert.ok(
    leadUpdates[0].filters.some((f) => f.t === "eq" && f.col === "id" && f.val === "lead-1"),
    "update targets the originating lead",
  );
  assert.ok(leadUpdates[0].patch.notes.includes("⚡ 1-Click Clinic & Website Setup live"));

  // Redis cache invalidated so the site is instantly fresh
  assert.deepEqual(behavior.redisDels, [`clinic:slug:${res.slug}`]);
});

test("1-click setup is idempotent — existing live site is refreshed, not duplicated", async () => {
  const existingSlug = "arora-heart-clinic-delhi";
  const behavior = freshBehavior({
    leadFixture: {
      id: "lead-2",
      name: "Dr. Anil Arora",
      phone: "+919876543210",
      clinic_name: "Arora Heart Clinic",
      city: "Delhi",
      specialty: "Cardiologist",
      status: "demo_sent",
      custom_demo_url: `${APP_URL}/c/${existingSlug}`,
      notes: "existing",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    clinicsBySlug: {
      [existingSlug]: { id: "cln-existing", organization_id: "org-existing", slug: existingSlug },
    },
  });
  const { mod, sb } = loadCrmServer(behavior);

  const res = await mod.setupCompleteClinicFromLeadImpl({ leadId: "lead-2" });

  assert.equal(res.ok, true);
  assert.equal(res.isExisting, true);
  assert.equal(res.slug, existingSlug);
  assert.equal(res.url, `${APP_URL}/c/${existingSlug}`);
  assert.equal(res.clinicId, "cln-existing");
  assert.equal(res.organizationId, "org-existing");

  // No duplicate organization / clinic / doctor rows
  assert.equal(insertCalls(sb, "organizations").length, 0, "no duplicate org");
  assert.equal(insertCalls(sb, "clinics").length, 0, "no duplicate clinic");
  assert.equal(insertCalls(sb, "doctors").length, 0, "no duplicate doctor");

  // Existing clinic row is refreshed & re-published
  const clinicUpdates = updateCalls(sb, "clinics");
  assert.equal(clinicUpdates.length, 1);
  assert.equal(clinicUpdates[0].patch.doctor_name, "Dr. Anil Arora");
  assert.equal(clinicUpdates[0].patch.clinic_name, "Arora Heart Clinic");
  assert.equal(clinicUpdates[0].patch.is_published, true);
  assert.ok(
    clinicUpdates[0].filters.some(
      (f) => f.t === "eq" && f.col === "id" && f.val === "cln-existing",
    ),
  );
});

test("createCrmLeadImpl with auto_setup_clinic returns a lead whose demo URL is the live website", async () => {
  const behavior = freshBehavior({ nextLeadId: "lead-db-9" });
  const { mod, sb } = loadCrmServer(behavior);

  const lead = await mod.createCrmLeadImpl({
    name: "Dr. Sunil Rao",
    phone: "9823456780",
    clinic_name: "Sunrise Dental Care",
    city: "Jaipur",
    specialty: "Dentist",
    source: "manual",
    auto_setup_clinic: true,
  });

  assert.equal(lead.id, "lead-db-9");
  assert.equal(
    lead.phone,
    "+91982656780".slice(0, 0) + "+919823456780",
    "phone normalized to +91 format",
  );
  assert.equal(
    lead.custom_demo_url,
    `${APP_URL}/c/sunrise-dental-care-jaipur`,
    "auto_setup_clinic must replace the demo link with the live website URL",
  );
  // The full 1-click provisioning ran underneath
  assert.equal(insertCalls(sb, "organizations").length, 1);
  assert.equal(insertCalls(sb, "clinics").length, 1);
  assert.equal(insertCalls(sb, "clinics")[0].rows[0].slug, "sunrise-dental-care-jaipur");
});

// ---------------------------------------------------------------------------
// Autonomous outreach — auto-provision before pitching + reply halt check
// ---------------------------------------------------------------------------

test("triggerAutonomousLeadOutreachImpl auto-provisions the website then pitches it on WhatsApp", async () => {
  const behavior = freshBehavior({
    leadFixture: {
      id: "lead-out-1",
      name: "Dr. Anil Arora",
      phone: "+919876543210",
      clinic_name: "Arora Heart Clinic",
      city: "Jaipur",
      specialty: "Cardiologist",
      status: "new",
      custom_demo_url: null,
      has_replied: false,
      followup_count: 0,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  const { mod, sb } = loadCrmServer(behavior);

  const res = await mod.triggerAutonomousLeadOutreachImpl("lead-out-1");

  const liveUrl = `${APP_URL}/c/arora-heart-clinic-jaipur`;
  assert.equal(res.ok, true);
  assert.equal(res.sent, true);
  assert.ok(
    res.message.includes(liveUrl),
    "first pitch must contain the auto-provisioned live URL",
  );

  // Website was provisioned as part of outreach
  assert.equal(
    insertCalls(sb, "organizations").length,
    1,
    "website auto-provisioned before pitching",
  );
  assert.equal(insertCalls(sb, "clinics")[0].rows[0].slug, "arora-heart-clinic-jaipur");

  // Pitch dispatched over the platform WhatsApp session
  assert.equal(behavior.sent.length, 1);
  assert.equal(behavior.sent[0].session, "platform-admin");
  assert.equal(behavior.sent[0].phone, "919876543210");
  assert.ok(behavior.sent[0].text.includes(liveUrl));

  // CRM lead advanced to outreach_sent and the pitch was logged
  const leadUpdates = updateCalls(sb, "platform_crm_leads");
  assert.ok(
    leadUpdates.some((u) => u.patch.status === "outreach_sent" && u.patch.followup_count === 1),
    "lead staged as outreach_sent with followup 1",
  );
  const logs = insertCalls(sb, "whatsapp_logs");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].rows[0].template_key, "crm_autonomous_app_store_comprehensive");
  assert.equal(logs[0].rows[0].status, "sent");
});

test("triggerAutonomousLeadOutreachImpl never interrupts a doctor who already replied", async () => {
  const behavior = freshBehavior({
    leadFixture: {
      id: "lead-replied",
      name: "Dr. Anil Arora",
      phone: "+919876543210",
      clinic_name: "Arora Heart Clinic",
      city: "Jaipur",
      specialty: "Cardiologist",
      status: "in_conversation",
      custom_demo_url: null,
      has_replied: true,
      followup_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  const { mod, sb } = loadCrmServer(behavior);

  const res = await mod.triggerAutonomousLeadOutreachImpl("lead-replied");

  assert.equal(res.ok, true);
  assert.equal(res.sent, false, "halt check must stop autonomous messaging");
  assert.ok((res.error || "").includes("already replied"));
  assert.equal((behavior.sent || []).length, 0, "nothing dispatched");
  assert.equal(insertCalls(sb, "organizations").length, 0, "no provisioning side effects");
});

// ---------------------------------------------------------------------------
// Platform AI Outreach agent — doctors asking for the website link
// ---------------------------------------------------------------------------

function loadPlatformAiAgent(behavior) {
  const crmBehavior = freshBehavior();
  const { mod: realCrm } = loadCrmServer(crmBehavior);
  const setupCalls = [];
  const aiCrmModule = {
    // Pure logic comes from the real module; DB/AI transport stays mocked.
    isLidPhone: realCrm.isLidPhone,
    cleanDoctorName: realCrm.cleanDoctorName,
    normalizeIndianPhone: realCrm.normalizeIndianPhone,
    buildDemoUrl: realCrm.buildDemoUrl,
    getSpecialtyClinicProfile: realCrm.getSpecialtyClinicProfile,
    listCrmLeadsImpl: async () => behavior.listLeadsResult || [],
    createCrmLeadImpl: async (input) => {
      (behavior.createLeadCalls = behavior.createLeadCalls || []).push(input);
      return behavior.createdLeadFixture;
    },
    updateCrmLeadImpl: async (input) => {
      (behavior.updateLeadCalls = behavior.updateLeadCalls || []).push(input);
      return {};
    },
    setupCompleteClinicFromLeadImpl: async (args) => {
      setupCalls.push(args);
      return (
        behavior.setupResult || {
          ok: true,
          leadId: args.leadId,
          clinicId: "cln-ai-1",
          organizationId: "org-ai-1",
          slug: "meera-dental-studio-pune",
          url: `${APP_URL}/c/meera-dental-studio-pune`,
          doctorName: "Dr. Meera Rao",
          clinicName: "Meera Dental Studio",
          specialty: "Dentist",
          isExisting: false,
        }
      );
    },
  };
  const sb = makeSupabaseAdmin(makeResolver(behavior));
  const moduleExports = {};
  const requireHook = (name) => {
    if (name === "@/integrations/supabase/client.server") return { supabaseAdmin: sb };
    if (name === "./ai.server") {
      return {
        // Fixture AI outage: exercises the deterministic fallback reply matrix,
        // which must still deliver the live website link.
        callAI: async () => {
          throw new Error("fixture offline AI");
        },
      };
    }
    if (name === "./baileys.server") return behavior.baileys;
    if (name === "./crm.server") return aiCrmModule;
    throw new Error(`Unreviewed import blocked: ${name}`);
  };
  vm.runInNewContext(transpile(AI_SOURCE), {
    exports: moduleExports,
    require: requireHook,
    console: silentConsole,
    crypto: require("node:crypto"),
    process: { env: {} },
  });
  return { mod: moduleExports, sb, setupCalls };
}

test("AI outreach auto-generates the clinic website when a doctor asks for the link", async () => {
  const behavior = freshBehavior();
  const { mod, setupCalls } = loadPlatformAiAgent(behavior);

  const reply = await mod.generatePlatformAiReply({
    senderPhone: "+919876543210",
    senderName: "Dr. Anil Arora",
    incomingText: "Haan ji, meri clinic ki website bana ke bhejo",
    lead: {
      id: "lead-7",
      name: "Dr. Anil Arora",
      clinic_name: "Arora Heart Clinic",
      specialty: "Cardiologist",
      city: "Jaipur",
      custom_demo_url: null,
    },
  });

  // The website was generated on-the-fly for this exact lead
  assert.equal(setupCalls.length, 1, "one setup call");
  assert.equal(setupCalls[0].leadId, "lead-7");

  const liveUrl = `${APP_URL}/c/meera-dental-studio-pune`;
  assert.ok(reply.includes(liveUrl), "reply must contain the freshly generated live URL");
  assert.ok(reply.includes(`${liveUrl}/walkin`), "reply must include the walk-in token link");
  assert.ok(reply.includes("👉"), "reply points at the link");
  assert.ok(reply.includes("Arora Heart Clinic"), "reply is personalized to the clinic");
});

test("AI outreach does not regenerate when the live website already exists", async () => {
  const behavior = freshBehavior();
  const { mod, setupCalls } = loadPlatformAiAgent(behavior);
  const existingUrl = `${APP_URL}/c/arora-live-clinic`;

  const reply = await mod.generatePlatformAiReply({
    senderPhone: "+919876543210",
    senderName: "Dr. Anil Arora",
    incomingText: "demo link dikhao",
    lead: {
      id: "lead-8",
      name: "Dr. Anil Arora",
      clinic_name: "Arora Heart Clinic",
      specialty: "Cardiologist",
      city: "Jaipur",
      custom_demo_url: existingUrl,
    },
  });

  assert.equal(setupCalls.length, 0, "existing live URL must not trigger regeneration");
  assert.ok(reply.includes(existingUrl), "reply re-shares the existing live URL");
});

test("AI outreach answers pricing without touching website provisioning", async () => {
  const behavior = freshBehavior();
  const { mod, setupCalls } = loadPlatformAiAgent(behavior);

  const reply = await mod.generatePlatformAiReply({
    senderPhone: "+919876543210",
    senderName: "Dr. Anil Arora",
    incomingText: "Price kya hai monthly ka?",
    lead: {
      id: "lead-9",
      name: "Dr. Anil Arora",
      clinic_name: "Arora Heart Clinic",
      specialty: "Cardiologist",
      city: "Jaipur",
      custom_demo_url: null,
    },
  });

  assert.equal(setupCalls.length, 0, "pricing questions must not provision websites");
  assert.ok(reply.includes("₹999"), "pricing anchor present");
});

test("incoming WhatsApp website request end-to-end: lead captured, site generated, link sent", async () => {
  const behavior = freshBehavior({
    createdLeadFixture: {
      id: "lead-auto-1",
      name: "Dr. Meera Rao",
      phone: "+919812345678",
      email: null,
      clinic_name: "Meera Dental Studio",
      city: "Pune",
      specialty: "Dentist",
      source: "whatsapp_inbound",
      status: "new",
      custom_demo_url: null,
      has_replied: false,
      followup_count: 0,
      notes: null,
      whatsapp_lid: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  const { mod, sb, setupCalls } = loadPlatformAiAgent(behavior);

  const result = await mod.handlePlatformIncomingWhatsApp({
    rawFrom: "919812345678@s.whatsapp.net",
    text: "Kya meri clinic ki website ban sakti hai? Link do",
    senderName: "Meera Rao",
    sessionId: "platform",
    isBridgeLiveEvent: true,
    senderPn: null,
    senderLid: null,
  });

  // Lead auto-captured from the inbound conversation
  assert.equal(behavior.createLeadCalls.length, 1);
  assert.equal(behavior.createLeadCalls[0].phone, "+919812345678");
  assert.equal(behavior.createLeadCalls[0].source, "whatsapp_inbound");

  // Website auto-generated for the captured lead
  assert.equal(setupCalls.length, 1);
  assert.equal(setupCalls[0].leadId, "lead-auto-1");

  // Link delivered back over WhatsApp
  const liveUrl = `${APP_URL}/c/meera-dental-studio-pune`;
  assert.equal(result.ok, true);
  assert.equal(result.handled, true);
  assert.equal(result.sent, true);
  assert.equal(result.leadId, "lead-auto-1");
  assert.equal(result.aiEnabled, true);
  assert.equal(behavior.sent.length, 1);
  assert.equal(behavior.sent[0].phone, "+919812345678");
  assert.ok(
    behavior.sent[0].text.includes(liveUrl),
    "outbound WhatsApp message carries the live link",
  );

  // Conversation recorded: log + lead moved into the conversation stage
  const logs = insertCalls(sb, "whatsapp_logs");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].rows[0].template_key, "platform_ai_outreach_reply");
  assert.equal(logs[0].rows[0].status, "sent");
  const leadUpdates = updateCalls(sb, "platform_crm_leads");
  assert.ok(
    leadUpdates.some((u) => u.patch.status === "in_conversation" && u.patch.has_replied === true),
    "lead promoted to in_conversation with has_replied",
  );
  assert.ok(
    (behavior.updateLeadCalls || []).some((u) => u.status === "in_conversation"),
    "CRM stage mirrored through updateCrmLeadImpl",
  );
});
