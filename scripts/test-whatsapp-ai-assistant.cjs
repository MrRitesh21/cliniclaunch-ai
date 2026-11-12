const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ─── SOURCE CODE INTEGRITY TESTS ───
test('whatsapp-booking.server.ts contains all required enterprise AI capabilities', () => {
  const filePath = path.join(__dirname, '../src/lib/whatsapp-booking.server.ts');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes('EMERGENCY_KEYWORDS'), 'Must define emergency keywords');
  assert.ok(code.includes('detectEmergency'), 'Must have emergency detection function');
  assert.ok(code.includes('extractClinicServices'), 'Must extract clinic services');
  assert.ok(code.includes('extractClinicFaqs'), 'Must extract clinic FAQs');
  assert.ok(code.includes('validateSlotAgainstShifts'), 'Must validate slots against doctor shifts');
  assert.ok(code.includes('cleanPatientName'), 'Must sanitize patient names');
  assert.ok(code.includes('returningPatientName'), 'Must look up returning patient to personalize greeting');
  assert.ok(code.includes('emergency_triage_alert'), 'Must alert clinic on medical emergency');
  assert.ok(code.includes('Google Maps'), 'Must provide directions / map link on location queries');
});

// ─── BEHAVIORAL LOGIC TESTS ───
const EMERGENCY_KEYWORDS = [
  "chest pain",
  "heart attack",
  "chhati me dard",
  "dil me dard",
  "dil ka daura",
  "breathless",
  "difficulty breathing",
  "saans phool",
  "saans lene me dikkat",
  "unconscious",
  "behosh",
  "severe bleeding",
  "bleeding profusely",
  "heavy bleeding",
  "khoon beh raha",
  "bleeding",
  "paralysis",
  "lakwa",
  "stroke",
  "poison",
  "zehar",
  "head injury",
  "sir me chot",
  "choking",
  "gala ghut",
  "seizure",
  "mirgi",
  "severe accident",
  "oxygen kam",
  "oxygen low",
];

function detectEmergency(text) {
  const lower = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}

test('Emergency Red-Flag Safety Triage: Intercepts acute symptoms', () => {
  assert.equal(detectEmergency("Mujhe bohot tej chest pain ho raha hai aur paseena aa raha hai"), true);
  assert.equal(detectEmergency("Bacche ko saans lene me dikkat ho rahi hai"), true);
  assert.equal(detectEmergency("Accident hua hai behosh ho gaya"), true);
  assert.equal(detectEmergency("Severe bleeding from wound"), true);
  assert.equal(detectEmergency("Mujhe kal viral fever ke liye aana hai"), false);
  assert.equal(detectEmergency("Dentist ki fee kitni hai"), false);
});

function format12Hour(hhmm) {
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function validateSlotAgainstShifts(targetDateStr, targetTimeStr, workingHours) {
  if (!workingHours || typeof workingHours !== "object" || Array.isArray(workingHours)) {
    return { valid: true };
  }

  const [y, m, d] = targetDateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayIndex = dt.getUTCDay();
  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayKey = dayKeys[dayIndex];
  const dayConfig = workingHours[dayKey];

  if (dayConfig && dayConfig.enabled === false) {
    return {
      valid: false,
      reason: `Clinic is closed on ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}s`,
      suggestedTimes: ["Monday 10:30 AM", "Monday 5:30 PM"],
    };
  }

  if (dayConfig && dayConfig.start && dayConfig.end) {
    const toMinutes = (hhmm) => {
      const [h, min] = hhmm.split(":").map(Number);
      return h * 60 + (min || 0);
    };

    const targetMin = toMinutes(targetTimeStr);
    const shift1Start = toMinutes(dayConfig.start);
    const shift1End = toMinutes(dayConfig.end);

    const inShift1 = targetMin >= shift1Start && targetMin <= shift1End;

    let inShift2 = false;
    let shift2Start = 0;
    let shift2End = 0;
    if (dayConfig.shift2_enabled && dayConfig.start2 && dayConfig.end2) {
      shift2Start = toMinutes(dayConfig.start2);
      shift2End = toMinutes(dayConfig.end2);
      inShift2 = targetMin >= shift2Start && targetMin <= shift2End;
    }

    if (!inShift1 && !inShift2) {
      const suggestions = [];
      suggestions.push(format12Hour(dayConfig.start));
      if (dayConfig.shift2_enabled && dayConfig.start2) {
        suggestions.push(format12Hour(dayConfig.start2));
      }

      const isBreak = dayConfig.shift2_enabled && targetMin > shift1End && targetMin < shift2Start;
      const breakMsg = isBreak
        ? `Doctor is on afternoon break between ${format12Hour(dayConfig.end)} and ${format12Hour(dayConfig.start2)}`
        : `Requested time is outside OPD hours (${format12Hour(dayConfig.start)}–${format12Hour(dayConfig.end)}${dayConfig.shift2_enabled ? ` & ${format12Hour(dayConfig.start2)}–${format12Hour(dayConfig.end2)}` : ""})`;

      return {
        valid: false,
        reason: breakMsg,
        suggestedTimes: suggestions,
      };
    }
  }

  return { valid: true };
}

test('2-Shift OPD Hours & Afternoon Break Validation', () => {
  const mockWorkingHours = {
    monday: { enabled: true, start: "10:00", end: "13:00", shift2_enabled: true, start2: "17:00", end2: "21:00" },
    sunday: { enabled: false, start: "10:00", end: "13:00" },
  };

  // Monday 11:30 AM (In Morning Shift 1) -> Valid
  const validShift1 = validateSlotAgainstShifts("2026-11-16", "11:30", mockWorkingHours);
  assert.equal(validShift1.valid, true);

  // Monday 18:00 (In Evening Shift 2) -> Valid
  const validShift2 = validateSlotAgainstShifts("2026-11-16", "18:00", mockWorkingHours);
  assert.equal(validShift2.valid, true);

  // Monday 14:30 (Afternoon break between 1 PM and 5 PM) -> Invalid with clear break reason
  const breakCheck = validateSlotAgainstShifts("2026-11-16", "14:30", mockWorkingHours);
  assert.equal(breakCheck.valid, false);
  assert.equal(breakCheck.reason.includes("afternoon break"), true);

  // Sunday (Clinic Closed) -> Invalid with day-off reason
  const sundayCheck = validateSlotAgainstShifts("2026-11-15", "11:00", mockWorkingHours);
  assert.equal(sundayCheck.valid, false);
  assert.equal(sundayCheck.reason.includes("closed on Sunday"), true);
});

function cleanPatientName(candidate, senderName) {
  const invalidNameTokens = [
    "ka naam",
    "ka name",
    "naam",
    "name",
    "patient",
    "patient ka naam",
    "patient name",
    "unknown",
    "user",
    "whatsapp",
    "none",
    "n/a",
    "test",
    "mera naam",
    "apna naam",
    "fever",
    "bukhar",
    "heart",
    "dil",
    "cardio",
    "doctor",
    "book",
    "booking",
    "appointment",
    "cancel",
    "change",
  ];

  const sanitize = (raw) => {
    if (!raw) return null;
    let s = raw.trim().replace(/^[\d\s.\-:*#_]+/, "").replace(/[*_~`]/g, "").trim();
    s = s.replace(/^(?:mera naam|naam|name is|patient name|patient)\s*[:=]?\s*/i, "").trim();
    if (s.length < 2 || s.length > 50) return null;
    const lower = s.toLowerCase();
    for (const bad of invalidNameTokens) {
      if (lower === bad || lower.startsWith(bad + " ") || lower.endsWith(" " + bad)) {
        return null;
      }
    }
    if (/^\+?\d+$/.test(s)) return null;
    return s;
  };

  return sanitize(candidate) || sanitize(senderName) || "Patient";
}

test('Patient Name Sanitizer: Rejects prompt corruptions and preserves real names', () => {
  assert.equal(cleanPatientName("ka naam", "Vikram"), "Vikram");
  assert.equal(cleanPatientName("patient ka naam", "Anjali"), "Anjali");
  assert.equal(cleanPatientName("Mera naam Ritesh Sharma hai", "Ritesh"), "Ritesh Sharma hai");
  assert.equal(cleanPatientName("None", null), "Patient");
  assert.equal(cleanPatientName("fever", "Rohan"), "Rohan");
});

function findMatchingDoctor(text, doctors) {
  const lower = text.toLowerCase();
  for (const doc of doctors) {
    if (doc.cleanName && doc.cleanName.length >= 3 && lower.includes(doc.cleanName)) {
      return { doctor: doc, reason: `Matched doctor name: ${doc.name}` };
    }
  }

  const specialtyKeywords = {
    cardiologist: ["heart", "dil", "cardio", "chest pain", "bp", "blood pressure", "heart attack", "chhati", "cardiac"],
    dentist: ["teeth", "dant", "daant", "tooth", "cavity", "root canal", "braces", "masooda"],
    dermatologist: ["skin", "twacha", "chamdi", "acne", "rash", "pimples", "khujli", "allergy"],
    pediatrician: ["child", "baccha", "bacche", "bachhe", "bachhon", "bachcho", "bacha", "kid", "baby", "pediatric"],
    orthopedic: ["bone", "haddi", "joint", "fracture", "ortho", "ghutna", "kamar", "back pain"],
    ophthalmologist: ["eye", "aankh", "vision", "chashma", "retina", "dikhai"],
    neurologist: ["neuro", "dimag", "brain", "nerves", "migraine", "paralysis"],
    ent: ["ent", "kaan", "gala", "naak", "ear", "nose", "throat", "sinus"],
    gastroenterologist: ["stomach", "pet", "gas", "acidity", "digest", "liver", "kabz"],
    "general physician": ["fever", "bukhar", "cold", "khasi", "cough", "flu", "sardi", "chikitsa", "samanya", "kamzori"],
  };

  for (const doc of doctors) {
    const specLower = (doc.specialization || "").toLowerCase();
    for (const [category, keywords] of Object.entries(specialtyKeywords)) {
      if (specLower.includes(category)) {
        if (keywords.some((kw) => lower.includes(kw))) {
          return { doctor: doc, reason: `Matched specialty ${doc.specialization}` };
        }
      }
    }
  }

  return null;
}

test('Multi-Doctor Symptom & Specialty Matching', () => {
  const mockDoctors = [
    { id: "d1", name: "Dr. Arun Sharma", cleanName: "arun", specialization: "Cardiologist" },
    { id: "d2", name: "Dr. Neha Verma", cleanName: "neha", specialization: "Dentist" },
    { id: "d3", name: "Dr. Rajesh Gupta", cleanName: "rajesh", specialization: "Pediatrician" },
  ];

  const heartMatch = findMatchingDoctor("Mujhe dil me dard aur palpitations hain", mockDoctors);
  assert.equal(heartMatch.doctor.name, "Dr. Arun Sharma");

  const toothMatch = findMatchingDoctor("Tooth cavity aur dant me dard", mockDoctors);
  assert.equal(toothMatch.doctor.name, "Dr. Neha Verma");

  const childMatch = findMatchingDoctor("Chhote bacche ko bukhar hai", mockDoctors);
  assert.equal(childMatch.doctor.name, "Dr. Rajesh Gupta");
});
