const assert = require('node:assert/strict');
const test = require('node:test');

// ============================================================================
// 1. DOCTOR PROFILE & SCHEDULE LOGIC TEST SUITE
// ============================================================================
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function defaultWeeklySchedule(isTwoShifts = false, slotDuration = 30, maxPatients = 1) {
  const sched = {
    is_two_shifts: isTwoShifts,
    slot_duration_minutes: slotDuration,
    max_patients_per_slot: maxPatients,
  };
  for (const d of DAYS) {
    sched[d] = {
      enabled: d !== "sunday",
      start: isTwoShifts ? "10:00" : "09:00",
      end: isTwoShifts ? "13:00" : "18:00",
      shift2_enabled: isTwoShifts,
      start2: "17:00",
      end2: "21:00",
    };
  }
  return sched;
}

function calculateAvailableSlots(daySchedule, slotDurationMinutes, maxPatientsPerSlot = 1) {
  if (!daySchedule.enabled) return [];
  const slots = [];

  function parseTime(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }
  function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // Shift 1
  if (daySchedule.start && daySchedule.end) {
    let current = parseTime(daySchedule.start);
    const end = parseTime(daySchedule.end);
    while (current + slotDurationMinutes <= end) {
      slots.push({
        shift: 1,
        startTime: formatTime(current),
        endTime: formatTime(current + slotDurationMinutes),
        capacity: maxPatientsPerSlot,
      });
      current += slotDurationMinutes;
    }
  }

  // Shift 2 (if enabled)
  if (daySchedule.shift2_enabled && daySchedule.start2 && daySchedule.end2) {
    let current = parseTime(daySchedule.start2);
    const end = parseTime(daySchedule.end2);
    while (current + slotDurationMinutes <= end) {
      slots.push({
        shift: 2,
        startTime: formatTime(current),
        endTime: formatTime(current + slotDurationMinutes),
        capacity: maxPatientsPerSlot,
      });
      current += slotDurationMinutes;
    }
  }

  return slots;
}

test('Doctor schedule generation: 2-shift morning & evening with custom slot durations', () => {
  const sched = defaultWeeklySchedule(true, 15, 2);
  assert.equal(sched.is_two_shifts, true);
  assert.equal(sched.slot_duration_minutes, 15);
  assert.equal(sched.max_patients_per_slot, 2);

  // Monday morning shift: 10:00 to 13:00 (180 mins = 12 slots of 15m)
  // Monday evening shift: 17:00 to 21:00 (240 mins = 16 slots of 15m)
  const mondaySlots = calculateAvailableSlots(sched.monday, 15, 2);
  assert.equal(mondaySlots.length, 28, 'Should generate 28 total slots (12 morning + 16 evening)');
  assert.equal(mondaySlots[0].startTime, '10:00');
  assert.equal(mondaySlots[0].capacity, 2);
  assert.equal(mondaySlots[11].endTime, '13:00');
  assert.equal(mondaySlots[12].shift, 2);
  assert.equal(mondaySlots[12].startTime, '17:00');
  assert.equal(mondaySlots[27].endTime, '21:00');

  // Sunday should be disabled by default
  const sundaySlots = calculateAvailableSlots(sched.sunday, 15, 2);
  assert.equal(sundaySlots.length, 0, 'Sunday should have 0 slots when day is off');
});

test('Doctor profile validation: Registration council, number, fees and qualifications', () => {
  function validateDoctorProfile(profile) {
    const errors = [];
    if (!profile.name || profile.name.trim().length < 2) errors.push('Name is required');
    if (!profile.qualification || profile.qualification.trim().length < 2) errors.push('Qualification is required');
    if (!profile.specialization) errors.push('Specialization is required');
    if (typeof profile.consultation_fee !== 'number' || profile.consultation_fee < 0) {
      errors.push('Consultation fee must be non-negative');
    }
    if (profile.registration_number && !profile.registration_council) {
      errors.push('Registration council is required if registration number is provided');
    }
    return { valid: errors.length === 0, errors };
  }

  const validProfile = {
    name: 'Dr. Anita Desai',
    qualification: 'MBBS, MD (Medicine)',
    specialization: 'Internal Medicine',
    consultation_fee: 500,
    registration_number: 'MCI-48291',
    registration_council: 'Delhi Medical Council',
  };
  const resValid = validateDoctorProfile(validProfile);
  assert.equal(resValid.valid, true);

  const invalidProfile = {
    name: '',
    qualification: '',
    specialization: '',
    consultation_fee: -50,
    registration_number: 'MCI-123',
    registration_council: '',
  };
  const resInvalid = validateDoctorProfile(invalidProfile);
  assert.equal(resInvalid.valid, false);
  assert.ok(resInvalid.errors.includes('Name is required'));
  assert.ok(resInvalid.errors.includes('Consultation fee must be non-negative'));
  assert.ok(resInvalid.errors.includes('Registration council is required if registration number is provided'));
});

// ============================================================================
// 2. LIVE OPD QUEUE TRANSITION & STATE MACHINE TEST SUITE
// ============================================================================
const VALID_QUEUE_STATUSES = ['waiting', 'serving', 'done', 'skipped', 'cancelled', 'emergency'];

function transitionQueueStatus(currentItem, newStatus) {
  if (!VALID_QUEUE_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid queue status: ${newStatus}`);
  }
  const now = new Date().toISOString();
  const updated = { ...currentItem, status: newStatus };

  if (newStatus === 'serving') {
    updated.called_at = now;
  } else if (newStatus === 'done' || newStatus === 'skipped') {
    updated.completed_at = now;
  } else if (newStatus === 'emergency') {
    updated.priority = true;
  }
  return updated;
}

function selectNextPatient(queueList) {
  // Priority 1: Emergency calls (priority: true, status: 'waiting')
  // Priority 2: Earliest waiting tokens (by token_number or created_at)
  const waiting = queueList.filter((item) => item.status === 'waiting');
  if (waiting.length === 0) return null;

  return waiting.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    if (a.token_number && b.token_number) return a.token_number - b.token_number;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
}

test('OPD Queue state machine: waiting -> serving -> done lifecycle and emergency call-in', () => {
  const item = {
    id: 'tok-101',
    token_number: 14,
    patient_name: 'Vikram Mehta',
    status: 'waiting',
    priority: false,
    created_at: '2026-11-12T09:00:00.000Z',
  };

  const called = transitionQueueStatus(item, 'serving');
  assert.equal(called.status, 'serving');
  assert.ok(called.called_at, 'Serving state must set called_at');

  const completed = transitionQueueStatus(called, 'done');
  assert.equal(completed.status, 'done');
  assert.ok(completed.completed_at, 'Done state must set completed_at');

  const emergencyItem = { ...item, id: 'tok-102', token_number: 15 };
  const escalated = transitionQueueStatus(emergencyItem, 'emergency');
  assert.equal(escalated.status, 'emergency');
  assert.equal(escalated.priority, true);
});

test('OPD Queue: Call Next Patient prioritizes emergency call-in over regular waiting queue', () => {
  const queue = [
    { id: '1', token_number: 5, patient_name: 'Patient A', status: 'waiting', priority: false, created_at: '2026-11-12T09:00:00Z' },
    { id: '2', token_number: 6, patient_name: 'Patient B', status: 'waiting', priority: false, created_at: '2026-11-12T09:05:00Z' },
    { id: '3', token_number: 12, patient_name: 'Emergency Patient C', status: 'waiting', priority: true, created_at: '2026-11-12T09:10:00Z' },
    { id: '4', token_number: 4, patient_name: 'Patient D', status: 'done', priority: false, created_at: '2026-11-12T08:50:00Z' },
  ];

  const next = selectNextPatient(queue);
  assert.ok(next);
  assert.equal(next.id, '3', 'Emergency patient must be called before earlier token numbers');
  assert.equal(next.patient_name, 'Emergency Patient C');

  // Once Emergency is served, Patient A (token 5) should be next
  queue[2].status = 'serving';
  const nextRegular = selectNextPatient(queue);
  assert.ok(nextRegular);
  assert.equal(nextRegular.id, '1');
  assert.equal(nextRegular.token_number, 5);
});

// ============================================================================
// 3. CONSULTATION PRESCRIPTION DRAFTING & 1-TAP TREATMENT BUNDLES
// ============================================================================
const TREATMENT_BUNDLES = {
  URI_COLD: {
    name: 'Upper Respiratory Infection / Common Cold',
    diagnosis: 'Acute Viral Rhinopharyngitis (URI)',
    chief_complaint: 'Runny nose, nasal congestion, mild fever and sore throat for 3 days',
    medicines: [
      { drug_name: 'Tab Paracetamol 650mg', dose: '1 tab', frequency: '1-0-1 (SOS for fever)', duration: '3 days', instructions: 'After meals' },
      { drug_name: 'Tab Cetirizine 10mg', dose: '1 tab', frequency: '0-0-1 (Night)', duration: '5 days', instructions: 'After food, may cause drowsiness' },
      { drug_name: 'Saline Nasal Spray', dose: '2 puffs', frequency: 'TID', duration: '5 days', instructions: 'Both nostrils as needed' },
    ],
    advice: 'Steam inhalation twice daily. Warm saline gargles. Hydrate well.',
  },
  GASTROENTERITIS: {
    name: 'Acute Gastroenteritis / Diarrhea',
    diagnosis: 'Acute Gastroenteritis without Dehydration',
    chief_complaint: 'Loose stools (4-5 episodes) with mild abdominal cramps since yesterday',
    medicines: [
      { drug_name: 'ORS Sachet (WHO Formula)', dose: '1 sachet in 1L water', frequency: 'Frequent sips', duration: '3 days', instructions: 'Drink after each loose stool' },
      { drug_name: 'Cap Racecadotril 100mg', dose: '1 cap', frequency: '1-1-1', duration: '3 days', instructions: 'Before meals' },
      { drug_name: 'Tab Pantoprazole 40mg', dose: '1 tab', frequency: '1-0-0', duration: '5 days', instructions: '30 mins before breakfast' },
    ],
    advice: 'Bland diet (khichdi, curd-rice, banana). Avoid milk and oily foods. Hydrate.',
  },
  HTN_FOLLOWUP: {
    name: 'Hypertension Follow-up',
    diagnosis: 'Essential Primary Hypertension (Controlled)',
    chief_complaint: 'Routine follow-up visit for BP management, no complaints',
    medicines: [
      { drug_name: 'Tab Telmisartan 40mg', dose: '1 tab', frequency: '1-0-0 (Morning)', duration: '30 days', instructions: 'After breakfast daily' },
      { drug_name: 'Tab Amlodipine 5mg', dose: '1 tab', frequency: '0-0-1 (Night)', duration: '30 days', instructions: 'At bedtime' },
    ],
    advice: 'Low salt diet (< 5g/day). 30 mins brisk walking. Daily home BP monitoring.',
  },
};

function applyTreatmentBundle(currentConsultation, bundleKey) {
  const bundle = TREATMENT_BUNDLES[bundleKey];
  if (!bundle) throw new Error(`Unknown treatment bundle: ${bundleKey}`);

  return {
    ...currentConsultation,
    diagnosis: currentConsultation.diagnosis ? `${currentConsultation.diagnosis}, ${bundle.diagnosis}` : bundle.diagnosis,
    chief_complaint: currentConsultation.chief_complaint || bundle.chief_complaint,
    treatment_plan: bundle.advice,
    prescriptions: [
      ...(currentConsultation.prescriptions || []),
      ...bundle.medicines.map((m, idx) => ({
        ...m,
        position: (currentConsultation.prescriptions?.length || 0) + idx + 1,
      })),
    ],
  };
}

test('Consultation: 1-tap treatment bundle auto-populates diagnosis, medicines, and clinical advice', () => {
  const initialConsult = {
    patient_name: 'Rohan Verma',
    bp: '120/80 mmHg',
    pulse: '76 bpm',
    spo2: 98,
    bloodSugar: 104,
    chief_complaint: '',
    diagnosis: '',
    treatment_plan: '',
    prescriptions: [],
  };

  const withURI = applyTreatmentBundle(initialConsult, 'URI_COLD');
  assert.equal(withURI.diagnosis, 'Acute Viral Rhinopharyngitis (URI)');
  assert.ok(withURI.chief_complaint.includes('Runny nose'));
  assert.equal(withURI.prescriptions.length, 3);
  assert.equal(withURI.prescriptions[0].drug_name, 'Tab Paracetamol 650mg');
  assert.equal(withURI.prescriptions[0].frequency, '1-0-1 (SOS for fever)');
  assert.equal(withURI.prescriptions[1].drug_name, 'Tab Cetirizine 10mg');
  assert.ok(withURI.treatment_plan.includes('Steam inhalation'));

  // Vitals remain intact
  assert.equal(withURI.bp, '120/80 mmHg');
  assert.equal(withURI.spo2, 98);
});

// ============================================================================
// 4. MEDICAL RECORD RETRIEVAL & CLONE-RX PATTERN
// ============================================================================
function clonePreviousPrescription(pastPrescription, targetAppointmentId) {
  if (!pastPrescription || !Array.isArray(pastPrescription.items)) {
    throw new Error('Invalid past prescription record');
  }

  return {
    appointment_id: targetAppointmentId,
    patient_id: pastPrescription.patient_id,
    patient_name: pastPrescription.patient_name,
    cloned_from_rx_id: pastPrescription.id,
    notes: `Cloned from previous prescription dated ${pastPrescription.created_at.slice(0, 10)}`,
    items: pastPrescription.items.map((item, idx) => ({
      drug_name: item.drug_name,
      dose: item.dose,
      frequency: item.frequency,
      duration: item.duration,
      instructions: item.instructions,
      position: idx + 1,
    })),
  };
}

test('Records: Clone previous prescription preserves drug items and attaches clone provenance', () => {
  const pastPrescription = {
    id: 'rx-2024-001',
    patient_id: 'pat-99',
    patient_name: 'Meena Saxena',
    created_at: '2026-10-15T10:30:00.000Z',
    items: [
      { drug_name: 'Tab Metformin 500mg', dose: '1 tab', frequency: '1-0-1', duration: '30 days', instructions: 'With meals' },
      { drug_name: 'Tab Glimepiride 1mg', dose: '1 tab', frequency: '1-0-0', duration: '30 days', instructions: 'Before breakfast' },
    ],
  };

  const cloned = clonePreviousPrescription(pastPrescription, 'appt-2026-999');
  assert.equal(cloned.appointment_id, 'appt-2026-999');
  assert.equal(cloned.patient_id, 'pat-99');
  assert.equal(cloned.cloned_from_rx_id, 'rx-2024-001');
  assert.equal(cloned.items.length, 2);
  assert.equal(cloned.items[0].drug_name, 'Tab Metformin 500mg');
  assert.equal(cloned.items[1].drug_name, 'Tab Glimepiride 1mg');
  assert.ok(cloned.notes.includes('2026-10-15'));
});
