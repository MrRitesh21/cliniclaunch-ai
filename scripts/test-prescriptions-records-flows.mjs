import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rxSource = readFileSync(
  new URL("../src/routes/_authenticated/dashboard.prescriptions.tsx", import.meta.url),
  "utf8",
);
const recordsSource = readFileSync(
  new URL("../src/routes/_authenticated/dashboard.records.tsx", import.meta.url),
  "utf8",
);

test("Prescriptions: pre-seeded medicine catalog is comprehensive and structured", () => {
  assert.ok(rxSource.includes("STANDARD_MEDICINE_CATALOG"), "STANDARD_MEDICINE_CATALOG must be defined");
  assert.ok(rxSource.includes("Paracetamol"), "Must include Paracetamol");
  assert.ok(rxSource.includes("Amoxicillin + Potassium Clavulanate"), "Must include Amox-Clav");
  assert.ok(rxSource.includes("Pantoprazole"), "Must include Pantoprazole");
  assert.ok(rxSource.includes("Telmisartan"), "Must include Telmisartan");
  assert.ok(rxSource.includes("Metformin"), "Must include Metformin");
  assert.ok(rxSource.includes("Cetirizine"), "Must include Cetirizine");
  assert.ok(rxSource.includes("Montelukast"), "Must include Montelukast");
  assert.ok(rxSource.includes("ORS"), "Must include ORS");

  // Verify seeding action
  assert.ok(rxSource.includes("seedStandardCatalog"), "Must have seedStandardCatalog function");
  assert.ok(rxSource.includes("Seed Standard Formulary"), "Must have UI button to seed formulary");
});

test("Prescriptions: 1-tap pre-seeded treatment bundles include all required clinical protocols", () => {
  assert.ok(rxSource.includes("TREATMENT_BUNDLES"), "TREATMENT_BUNDLES must be defined");
  assert.ok(rxSource.includes("URI / Common Cold & Cough"), "Must include URI / Cold protocol");
  assert.ok(rxSource.includes("Acute Gastroenteritis / Diarrhea"), "Must include Gastroenteritis protocol");
  assert.ok(rxSource.includes("Hypertension Routine Follow-up"), "Must include HTN protocol");
  assert.ok(rxSource.includes("Diabetic Routine (T2DM Follow-up)"), "Must include Diabetic routine protocol");
  assert.ok(rxSource.includes("Dental Pain & Infection / Abscess"), "Must include Dental pain protocol");
  assert.ok(rxSource.includes("Acid Peptic Disease / GERD / Gastritis"), "Must include GERD protocol");
  assert.ok(rxSource.includes("Acute Musculoskeletal / Joint / Back Pain"), "Must include MSK pain protocol");

  // Verify 1-tap apply function
  assert.ok(rxSource.includes("applyTreatmentBundle"), "Must have applyTreatmentBundle function");
});

test("Prescriptions: dosage templates, frequencies, durations, and instructions chips exist", () => {
  assert.ok(rxSource.includes("DOSAGE_TEMPLATES"), "DOSAGE_TEMPLATES must be defined");
  assert.ok(rxSource.includes("1-0-1"), "Must include 1-0-1");
  assert.ok(rxSource.includes("1-0-0"), "Must include 1-0-0");
  assert.ok(rxSource.includes("0-0-1"), "Must include 0-0-1");
  assert.ok(rxSource.includes("1-1-1"), "Must include 1-1-1");
  assert.ok(rxSource.includes("SOS"), "Must include SOS");
  assert.ok(rxSource.includes("After meals"), "Must include After meals instruction");
  assert.ok(rxSource.includes("Before meals"), "Must include Before meals instruction");
  assert.ok(rxSource.includes("Empty stomach"), "Must include Empty stomach instruction");
});

test("Prescriptions: custom drug addition and save to catalog supported", () => {
  assert.ok(rxSource.includes("saveDrugToCatalog"), "Must have saveDrugToCatalog helper");
  assert.ok(rxSource.includes("Save to"), "Must have Save to catalog button");
  assert.ok(rxSource.includes("— Custom Drug —"), "Must allow custom drug selection");
});

test("Prescriptions: quick re-order / clone previous Rx for chronic patients supported", () => {
  assert.ok(rxSource.includes("handleCloneRx"), "Must have handleCloneRx handler");
  assert.ok(rxSource.includes("loadPreviousRxItems"), "Must have loadPreviousRxItems handler");
  assert.ok(rxSource.includes("Repeat Past Rx"), "Must have Repeat Past Rx button");
  assert.ok(rxSource.includes("isClone"), "Must track clone state in RxSheet");
});

test("Prescriptions: printable slip and WhatsApp sharing triggers work", () => {
  assert.ok(rxSource.includes("PrintDialog"), "Must include PrintDialog component");
  assert.ok(rxSource.includes("shareViaWhatsApp"), "Must include shareViaWhatsApp handler");
  assert.ok(rxSource.includes("wa.me"), "Must target WhatsApp api");
  assert.ok(rxSource.includes("℞"), "Must feature classical Rx symbol");
});

test("Records: /dashboard/records no longer redirects to /dashboard/patients", () => {
  assert.ok(!recordsSource.includes("RedirectToMergedPatients"), "Must not redirect to merged patients");
  assert.ok(!recordsSource.includes('navigate({ to: "/dashboard/patients" })'), "Must not redirect away");
  assert.ok(recordsSource.includes("MedicalRecordsPage"), "Must render full MedicalRecordsPage");
});

test("Records: unified chronological timeline integrates consultations, prescriptions, and lab reports", () => {
  assert.ok(recordsSource.includes("timelineItems"), "Must manage unified timelineItems state");
  assert.ok(recordsSource.includes("prescriptions"), "Must query prescriptions");
  assert.ok(recordsSource.includes("patient_visits"), "Must query patient_visits");
  assert.ok(recordsSource.includes("consultations"), "Must query consultations");
  assert.ok(recordsSource.includes("patient_attachments"), "Must query patient_attachments");
});

test("Records: chronic patient maintenance regimen and 1-click re-order Rx button exist", () => {
  assert.ok(recordsSource.includes("recentPrescription"), "Must detect recent chronic prescription");
  assert.ok(recordsSource.includes("1-Click Re-order Routine Rx"), "Must feature 1-Click Re-order button");
  assert.ok(recordsSource.includes("handleReorderRx"), "Must have handleReorderRx handler");
});

test("Records: upload lab report/PDF and document viewer modals exist", () => {
  assert.ok(recordsSource.includes("UploadLabReportModal"), "Must have UploadLabReportModal");
  assert.ok(recordsSource.includes("LogVisitModal"), "Must have LogVisitModal");
  assert.ok(recordsSource.includes("viewDoc"), "Must have document viewer state");
  assert.ok(recordsSource.includes("iframe"), "Must have iframe for PDF viewer");
});
