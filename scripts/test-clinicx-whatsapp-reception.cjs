#!/usr/bin/env node
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(root, "src/lib/whatsapp-booking.server.ts"), "utf8");

// Transpile with ts
const transpiled = ts.transpileModule(SOURCE, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

const modExports = {};
vm.runInNewContext(transpiled, {
  exports: modExports,
  require: (name) => {
    if (name.includes("whatsapp-rag.server")) {
      return {
        getSessionMemory: () => ({ turnCount: 1, lastUpdated: Date.now() }),
        updateSessionMemory: (_cid, _p, patch) => patch,
        clearSessionMemory: () => {},
        retrieveClinicKnowledge: async () => ({ contextText: "" }),
        retrieveRagContext: async () => "",
        checkGuardrails: () => ({ safe: true }),
      };
    }
    if (name.includes("ai.server")) return { callAI: async () => null };
    if (name.includes("client.server")) {
      const mockChain = () => {
        const chain = {
          select: () => chain,
          insert: () => chain,
          update: () => chain,
          upsert: () => chain,
          eq: () => chain,
          or: () => chain,
          ilike: () => chain,
          gte: () => chain,
          lte: () => chain,
          neq: () => chain,
          order: () => chain,
          limit: () => chain,
          single: async () => ({ data: { id: "mock-1" }, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
          then: (resolve) => resolve({ data: [], error: null }),
        };
        return chain;
      };
      return { supabaseAdmin: { from: () => mockChain() } };
    }
    if (name.includes("env.server")) return { serverEnv: {} };
    if (name.includes("crypto")) return require("crypto");
    return {};
  },
  process: { env: {} },
  Buffer,
  Date,
  setTimeout,
  clearTimeout,
  console,
});

test("sanitizeSenderName rejects religious slogans and statuses", () => {
  const { sanitizeSenderName } = modExports;
  assert.equal(sanitizeSenderName("शिव सदा सहायते"), null);
  assert.equal(sanitizeSenderName("Har Har Mahadev"), null);
  assert.equal(sanitizeSenderName("King attitude"), null);
  assert.equal(sanitizeSenderName("Ritesh"), "Ritesh");
  assert.equal(sanitizeSenderName("Dr. Ramesh Sharma"), "Dr. Ramesh Sharma");
});

test("detectMultiPatientBooking extracts two patients with distinct symptoms and doctors", () => {
  const { detectMultiPatientBooking } = modExports;
  const doctors = [
    { id: "doc-1", name: "Speech & Hearing Specialist", specialization: "Speech & Hearing", fee: 500 },
    { id: "doc-2", name: "Dr. Aanya Patel", specialization: "Dermatologist", fee: 700 },
  ];

  const text = "Ritesh muje ear pain hai or meri sister ko skin rashes hai uska name rimans hai dono ka appointment sham ko 5 baje ka kar do";
  const result = detectMultiPatientBooking(text, "शिव सदा सहायते", doctors);

  assert.equal(result.isMulti, true);
  assert.equal(result.patients.length, 2);

  const p1 = result.patients[0];
  assert.equal(p1.name, "Ritesh");
  assert.equal(p1.problem, "Ear pain");
  assert.equal(p1.doctorName, "Speech & Hearing Specialist");

  const p2 = result.patients[1];
  assert.equal(p2.name, "Rimans");
  assert.equal(p2.relation, "Sister");
  assert.equal(p2.problem, "Skin rashes");
  assert.equal(p2.doctorName, "Dr. Aanya Patel");
});

test("findMatchingDoctor maps ear pain to Speech & Hearing, and skin rashes to Dermatologist", () => {
  const { findMatchingDoctor } = modExports;
  const doctors = [
    { id: "doc-1", name: "Speech & Hearing Specialist", specialization: "Speech & Hearing", cleanName: "speech & hearing specialist" },
    { id: "doc-2", name: "Dr. Aanya Patel", specialization: "Dermatologist", cleanName: "aanya patel" },
  ];

  const earMatch = findMatchingDoctor("ear pain ho raha hai", doctors);
  assert.ok(earMatch);
  assert.equal(earMatch.doctor.name, "Speech & Hearing Specialist");

  const skinMatch = findMatchingDoctor("skin rashes allergy hai", doctors);
  assert.ok(skinMatch);
  assert.equal(skinMatch.doctor.name, "Dr. Aanya Patel");
});

test("processWhatsAppMessage handles multi-patient booking request with warm natural response", async () => {
  const { processWhatsAppMessage } = modExports;
  const clinic = {
    id: "clinic-1",
    organization_id: "org-1",
    clinic_name: "Ear to Brain Speech & Hearing Clinic",
    doctor_name: "Ear to Brain Speech & Hearing Clinic",
    specialization: "Speech & Hearing",
    working_hours: { interactive_buttons_enabled: false },
  };

  const res = await processWhatsAppMessage({
    clinic,
    patientPhone: "+919876543210",
    senderName: "शिव सदा सहायते",
    incomingText: "Ritesh muje ear pain hai or meri sister ko skin rashes hai uska name rimans hai dono ka appointment sham ko 5 baje ka kar do",
  });

  assert.ok(res.reply);
  // Must NOT include the religious slogan
  assert.ok(!res.reply.includes("शिव सदा सहायते"));
  // Must acknowledge Ritesh
  assert.ok(res.reply.includes("Ritesh"));
  // Must acknowledge 5 PM
  assert.ok(res.reply.includes("5:00") || res.reply.includes("shaam") || res.reply.includes("5 PM"));
  // Must ask for day warmly
  assert.ok(res.reply.includes("aaj ya kal") || res.reply.includes("din"));
  // Must not repeat robotic reception welcome
  assert.ok(!res.reply.startsWith("Namaste !!"));
});

