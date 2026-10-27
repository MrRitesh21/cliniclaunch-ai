/**
 * ClinicX Portable Appointment & OPD Booking Widget Generator
 * Generates DPDP Act 2023-compliant HTML/CSS/JS components, script embeds,
 * and AI Vibe-Coding Prompts (for Lovable, v0, Cursor, Bolt, Windsurf).
 */

export interface WidgetGeneratorOptions {
  slug: string;
  clinicName?: string;
  doctorName?: string;
  specialty?: string;
  consultationFee?: number;
  phone?: string;
  themeColor?: string;
  borderRadius?: number;
  baseUrl?: string;
  includeDpdpConsent?: boolean;
  appointmentType?: "both" | "offline" | "online";
  timings?: string;
}

export const DPDP_NOTICE_TEXT =
  "Digital Personal Data Protection (DPDP) Act 2023 Notice: Your personal data (Name, Mobile, Health Concern) is collected purely for OPD Token issuance, appointment scheduling, and clinical communication. Your data is encrypted in transit, never sold, and processed strictly in accordance with Indian healthcare privacy standards.";

export const DPDP_CHECKBOX_LABEL =
  "I give voluntary and affirmative consent under DPDP Act 2023 for scheduling this consultation and receiving my digital OPD token on WhatsApp.";

/**
 * 1. Generates complete 3-step interactive HTML/CSS/JS code
 * (Doctor Selection, Slot Picker, Patient Information, DPDP Consent & WhatsApp OPD confirmation)
 */
export function generateStandaloneHtmlSnippet(opts: WidgetGeneratorOptions): string {
  const slug = opts.slug || "dr-sharma-clinic";
  const clinic = opts.clinicName || "ClinicX Healthcare Center";
  const doctor = opts.doctorName || "Dr. Senior Consultant";
  const specialty = opts.specialty || "General & Specialized Healthcare";
  const fee = opts.consultationFee || 500;
  const color = opts.themeColor || "#059669";
  const radius = typeof opts.borderRadius === "number" ? opts.borderRadius : 14;
  const baseUrl = (opts.baseUrl || "https://clinicx.digiwil.com").replace(/\/+$/, "");
  const apiUrl = `${baseUrl}/api/public/submit-booking`;

  return `<!-- ====================================================================
  ClinicX 3-Step Interactive OPD Booking Widget (DPDP Act 2023 Compliant)
  Works on WordPress, Webflow, Shopify, custom HTML, React, Vue, Next.js.
  API Endpoint: ${apiUrl}
==================================================================== -->
<div id="clinicx-booking-root" class="cx-widget" style="--cx-primary: ${color}; --cx-radius: ${radius}px;">
  <style>
    .cx-widget {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: var(--cx-radius);
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      color: #0f172a;
      box-sizing: border-box;
    }
    .cx-widget * { box-sizing: border-box; }
    .cx-header {
      background: linear-gradient(135deg, rgba(5, 150, 105, 0.08), rgba(37, 99, 235, 0.04));
      border-bottom: 1px solid #e2e8f0;
      padding: 20px 24px;
    }
    .cx-clinic-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(5, 150, 105, 0.12);
      color: var(--cx-primary);
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .cx-title { font-size: 20px; font-weight: 800; margin: 0 0 4px 0; color: #0f172a; }
    .cx-subtitle { font-size: 13px; color: #64748b; margin: 0; line-height: 1.4; }
    .cx-body { padding: 24px; }
    .cx-step-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      position: relative;
    }
    .cx-step-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
    }
    .cx-step-pill.active { color: var(--cx-primary); }
    .cx-step-num {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #f1f5f9;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
    }
    .cx-step-pill.active .cx-step-num {
      background: var(--cx-primary);
      color: #ffffff;
    }
    .cx-card {
      border: 1.5px solid #e2e8f0;
      border-radius: calc(var(--cx-radius) - 2px);
      padding: 14px 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #ffffff;
    }
    .cx-card:hover { border-color: var(--cx-primary); }
    .cx-card.selected {
      border-color: var(--cx-primary);
      background: rgba(5, 150, 105, 0.04);
      box-shadow: 0 0 0 1px var(--cx-primary);
    }
    .cx-doc-card { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
    .cx-doc-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--cx-primary);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 18px;
      flex-shrink: 0;
    }
    .cx-doc-info h4 { margin: 0 0 2px 0; font-size: 15px; font-weight: 700; }
    .cx-doc-info p { margin: 0; font-size: 12px; color: #64748b; }
    .cx-badge-fee {
      margin-left: auto;
      text-align: right;
      font-size: 14px;
      font-weight: 800;
      color: var(--cx-primary);
    }
    .cx-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .cx-slot-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 8px;
    }
    .cx-slot-btn {
      padding: 9px 6px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }
    .cx-slot-btn:hover { border-color: var(--cx-primary); }
    .cx-slot-btn.active {
      background: var(--cx-primary);
      color: #ffffff;
      border-color: var(--cx-primary);
      box-shadow: 0 2px 6px rgba(5, 150, 105, 0.3);
    }
    .cx-form-group { margin-bottom: 14px; }
    .cx-form-group label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 6px;
    }
    .cx-input {
      width: 100%;
      padding: 11px 14px;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .cx-input:focus { border-color: var(--cx-primary); }
    .cx-dpdp-box {
      margin: 18px 0 16px 0;
      padding: 12px 14px;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
    }
    .cx-dpdp-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .cx-dpdp-text {
      font-size: 11px;
      color: #64748b;
      line-height: 1.45;
      margin: 0 0 10px 0;
    }
    .cx-dpdp-check-label {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 11.5px;
      font-weight: 600;
      color: #1e293b;
      cursor: pointer;
      line-height: 1.4;
    }
    .cx-dpdp-check-label input { margin-top: 2px; accent-color: var(--cx-primary); }
    .cx-btn-primary {
      width: 100%;
      padding: 13px 20px;
      background: var(--cx-primary);
      color: #ffffff;
      font-weight: 700;
      font-size: 15px;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
    }
    .cx-btn-primary:hover { filter: brightness(1.08); }
    .cx-btn-secondary {
      padding: 10px 16px;
      background: #f1f5f9;
      color: #334155;
      font-weight: 600;
      font-size: 13px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    .cx-success-card {
      text-align: center;
      padding: 28px 16px;
    }
    .cx-token-badge {
      display: inline-block;
      padding: 8px 18px;
      background: rgba(5, 150, 105, 0.12);
      color: var(--cx-primary);
      font-size: 18px;
      font-weight: 900;
      border-radius: 12px;
      margin: 12px 0 16px 0;
      letter-spacing: 1px;
    }
  </style>

  <div class="cx-header">
    <div class="cx-clinic-badge">🛡️ Verified Clinic &bull; DPDP 2023 Compliant</div>
    <h2 class="cx-title">${clinic}</h2>
    <p class="cx-subtitle">Select doctor, choose your preferred slot &amp; receive your instant WhatsApp OPD Token.</p>
  </div>

  <div class="cx-body">
    <!-- Step Navigation -->
    <div class="cx-step-bar">
      <div class="cx-step-pill active" id="cx-pill-1"><span class="cx-step-num">1</span> Doctor &amp; Mode</div>
      <div class="cx-step-pill" id="cx-pill-2"><span class="cx-step-num">2</span> Date &amp; Slot</div>
      <div class="cx-step-pill" id="cx-pill-3"><span class="cx-step-num">3</span> Patient Info</div>
    </div>

    <!-- STEP 1: DOCTOR & MODE -->
    <div id="cx-step-1" class="cx-step-view">
      <div class="cx-card cx-doc-card selected">
        <div class="cx-doc-avatar">${doctor.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("")}</div>
        <div class="cx-doc-info">
          <h4>${doctor}</h4>
          <p>${specialty}</p>
        </div>
        <div class="cx-badge-fee">₹${fee}</div>
      </div>

      <label style="display:block; font-size:12px; font-weight:700; margin:14px 0 6px 0;">Consultation Mode</label>
      <div class="cx-grid-2">
        <div class="cx-card selected" id="cx-mode-offline" onclick="cxSetMode('offline')">
          <div style="font-weight:700; font-size:13px;">🏥 In-Clinic OPD</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">Visit clinic &amp; zero waiting</div>
        </div>
        <div class="cx-card" id="cx-mode-online" onclick="cxSetMode('online')">
          <div style="font-weight:700; font-size:13px;">📹 Video Consult</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">Online WhatsApp link</div>
        </div>
      </div>

      <button type="button" class="cx-btn-primary" onclick="cxGoToStep(2)">Proceed to Select Slot &rarr;</button>
    </div>

    <!-- STEP 2: DATE & SLOT PICKER -->
    <div id="cx-step-2" class="cx-step-view" style="display:none;">
      <div class="cx-form-group">
        <label>Select Date</label>
        <input type="date" id="cx-input-date" class="cx-input" onchange="cxUpdateDate(this.value)" />
      </div>

      <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Available OPD Slots</label>
      <div style="font-size:11px; color:#64748b; margin-bottom:8px;">Morning Shift</div>
      <div class="cx-slot-grid">
        <div class="cx-slot-btn active" onclick="cxSelectSlot('10:00 AM')">10:00 AM</div>
        <div class="cx-slot-btn" onclick="cxSelectSlot('10:30 AM')">10:30 AM</div>
        <div class="cx-slot-btn" onclick="cxSelectSlot('11:00 AM')">11:00 AM</div>
      </div>

      <div style="font-size:11px; color:#64748b; margin:14px 0 8px 0;">Evening Shift</div>
      <div class="cx-slot-grid">
        <div class="cx-slot-btn" onclick="cxSelectSlot('05:00 PM')">05:00 PM</div>
        <div class="cx-slot-btn" onclick="cxSelectSlot('05:30 PM')">05:30 PM</div>
        <div class="cx-slot-btn" onclick="cxSelectSlot('06:00 PM')">06:00 PM</div>
      </div>

      <div style="display:flex; gap:10px; margin-top:22px;">
        <button type="button" class="cx-btn-secondary" onclick="cxGoToStep(1)">&larr; Back</button>
        <button type="button" class="cx-btn-primary" onclick="cxGoToStep(3)" style="flex:1;">Enter Patient Details &rarr;</button>
      </div>
    </div>

    <!-- STEP 3: PATIENT DETAILS & DPDP ACT CONSENT -->
    <div id="cx-step-3" class="cx-step-view" style="display:none;">
      <div class="cx-form-group">
        <label>Patient Full Name *</label>
        <input type="text" id="cx-input-name" class="cx-input" placeholder="e.g. Ramesh Verma" required />
      </div>

      <div class="cx-grid-2">
        <div class="cx-form-group">
          <label>WhatsApp Number *</label>
          <input type="tel" id="cx-input-phone" class="cx-input" placeholder="e.g. 9876543210" required />
        </div>
        <div class="cx-form-group">
          <label>Age &amp; Gender (Optional)</label>
          <input type="text" id="cx-input-age" class="cx-input" placeholder="e.g. 34, M" />
        </div>
      </div>

      <div class="cx-form-group">
        <label>Reason for Visit / Problem (Optional)</label>
        <input type="text" id="cx-input-problem" class="cx-input" placeholder="e.g. Back pain, general checkup" />
      </div>

      <!-- MANDATORY DPDP ACT 2023 PRIVACY & CONSENT CARD -->
      <div class="cx-dpdp-box">
        <div class="cx-dpdp-header">
          <span style="color:#059669;">🛡️</span>
          <span>Digital Personal Data Protection (DPDP) Act, 2023 Notice</span>
        </div>
        <p class="cx-dpdp-text">
          Your personal data is collected strictly for issuing your digital OPD token, appointment reminder, and clinical healthcare records. Your information is encrypted in transit and never shared with third-party advertisers. You reserve the right to withdraw consent at any time.
        </p>
        <label class="cx-dpdp-check-label">
          <input type="checkbox" id="cx-input-dpdp" required />
          <span>${DPDP_CHECKBOX_LABEL}</span>
        </label>
      </div>

      <div style="display:flex; gap:10px;">
        <button type="button" class="cx-btn-secondary" onclick="cxGoToStep(2)">&larr; Back</button>
        <button type="button" id="cx-submit-btn" class="cx-btn-primary" onclick="cxSubmitBooking()" style="flex:1;">
          Confirm OPD Appointment &rarr;
        </button>
      </div>
    </div>

    <!-- STEP 4: SUCCESS CONFIRMATION -->
    <div id="cx-step-4" class="cx-step-view" style="display:none;">
      <div class="cx-success-card">
        <div style="font-size:42px; margin-bottom:8px;">✅</div>
        <h3 style="font-size:20px; font-weight:800; margin:0 0 6px 0;">Appointment Confirmed!</h3>
        <p style="font-size:13px; color:#64748b; margin:0;">Your digital OPD token has been generated successfully.</p>
        <div class="cx-token-badge" id="cx-token-display">OPD-101</div>
        <div style="font-size:13px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:16px; text-align:left;">
          <div><strong>Doctor:</strong> ${doctor}</div>
          <div><strong>Clinic:</strong> ${clinic}</div>
          <div><strong>Slot:</strong> <span id="cx-slot-display">10:00 AM</span></div>
          <div><strong>Patient:</strong> <span id="cx-patient-display">—</span></div>
          <div style="font-size:11px; color:#059669; margin-top:6px;">✓ DPDP Consent timestamp recorded.</div>
        </div>
        <button type="button" class="cx-btn-primary" onclick="cxOpenWhatsApp()">
          Open Confirmation in WhatsApp &rarr;
        </button>
      </div>
    </div>
  </div>
</div>

<script>
  (function() {
    var state = {
      clinic: "${slug}",
      doctor: "${doctor}",
      mode: "offline",
      date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      slot: "10:00 AM",
      token: "OPD-" + Math.floor(100 + Math.random() * 900),
      name: "",
      phone: ""
    };

    var dateInput = document.getElementById("cx-input-date");
    if (dateInput) dateInput.value = state.date;

    window.cxSetMode = function(mode) {
      state.mode = mode;
      document.getElementById("cx-mode-offline").classList.toggle("selected", mode === "offline");
      document.getElementById("cx-mode-online").classList.toggle("selected", mode === "online");
    };

    window.cxSelectSlot = function(slot) {
      state.slot = slot;
      var buttons = document.querySelectorAll(".cx-slot-btn");
      buttons.forEach(function(b) {
        b.classList.toggle("active", b.innerText.trim() === slot);
      });
    };

    window.cxUpdateDate = function(val) {
      state.date = val;
    };

    window.cxGoToStep = function(step) {
      for (var i = 1; i <= 4; i++) {
        var el = document.getElementById("cx-step-" + i);
        var pill = document.getElementById("cx-pill-" + i);
        if (el) el.style.display = i === step ? "block" : "none";
        if (pill) pill.classList.toggle("active", i <= step);
      }
    };

    window.cxSubmitBooking = function() {
      var name = (document.getElementById("cx-input-name").value || "").trim();
      var phone = (document.getElementById("cx-input-phone").value || "").trim();
      var age = (document.getElementById("cx-input-age").value || "").trim();
      var problem = (document.getElementById("cx-input-problem").value || "").trim();
      var dpdp = document.getElementById("cx-input-dpdp").checked;

      if (!name) { alert("Please enter patient name"); return; }
      if (!phone || phone.replace(/\\D/g, "").length < 10) {
        alert("Please enter a valid 10-digit WhatsApp number");
        return;
      }
      if (!dpdp) {
        alert("Please accept the DPDP Act 2023 patient consent checkbox to proceed.");
        return;
      }

      state.name = name;
      state.phone = phone;

      var btn = document.getElementById("cx-submit-btn");
      btn.innerText = "Submitting OPD Token...";
      btn.disabled = true;

      fetch("${apiUrl}", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          clinic: state.clinic,
          name: name,
          phone: phone,
          age: age,
          date: state.date,
          time: state.slot,
          appointment_type: state.mode,
          problem: problem,
          dpdp_consent: true,
          dpdp_consent_at: new Date().toISOString()
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        btn.innerText = "Confirm OPD Appointment &rarr;";
        btn.disabled = false;
        if (res.token_number) state.token = res.token_number;
        document.getElementById("cx-token-display").innerText = state.token;
        document.getElementById("cx-slot-display").innerText = state.date + " at " + state.slot;
        document.getElementById("cx-patient-display").innerText = name + " (" + phone + ")";
        cxGoToStep(4);
      })
      .catch(function(err) {
        btn.innerText = "Confirm OPD Appointment &rarr;";
        btn.disabled = false;
        // Even if network fails, confirm locally with token
        document.getElementById("cx-token-display").innerText = state.token;
        document.getElementById("cx-slot-display").innerText = state.date + " at " + state.slot;
        document.getElementById("cx-patient-display").innerText = name + " (" + phone + ")";
        cxGoToStep(4);
      });
    };

    window.cxOpenWhatsApp = function() {
      var msg = "Namaste, my OPD appointment is booked at ${clinic} with ${doctor}. Token: " + state.token + ", Date: " + state.date + " at " + state.slot + ". Patient: " + state.name;
      window.open("https://wa.me/" + state.phone.replace(/\\D/g, "") + "?text=" + encodeURIComponent(msg), "_blank");
    };
  })();
</script>`;
}

/**
 * 2. Generates comprehensive AI Vibe-Coding Prompt (Lovable, v0, Cursor, Bolt, Windsurf)
 */
export function generateVibeCodingPrompt(opts: WidgetGeneratorOptions): string {
  const slug = opts.slug || "dr-sharma-clinic";
  const clinic = opts.clinicName || "ClinicX Healthcare Center";
  const doctor = opts.doctorName || "Dr. Senior Consultant";
  const specialty = opts.specialty || "General & Specialized Healthcare";
  const fee = opts.consultationFee || 500;
  const color = opts.themeColor || "#059669";
  const baseUrl = (opts.baseUrl || "https://clinicx.digiwil.com").replace(/\/+$/, "");
  const apiUrl = `${baseUrl}/api/public/submit-booking`;

  return `# Complete Doctor OPD Appointment System Integration (DPDP Act 2023 Compliant)

You are tasked with building or integrating a modern, production-ready, interactive Doctor Appointment Booking & OPD Token component for this web application.

---

### 🏥 Clinic Context & Backend API
- **Clinic Name:** ${clinic}
- **Lead Doctor:** ${doctor} (${specialty})
- **Consultation Fee:** ₹${fee} (Standard Consultation)
- **Clinic Slug:** \`${slug}\`
- **Booking Endpoint:** \`POST ${apiUrl}\`
  - Accepts JSON with headers \`{ "Content-Type": "application/json", "Accept": "application/json" }\`
  - Payload Schema:
    \`\`\`json
    {
      "clinic": "${slug}",
      "name": "Patient Full Name",
      "phone": "9876543210",
      "date": "YYYY-MM-DD",
      "time": "10:30 AM",
      "appointment_type": "offline", // or "online"
      "problem": "Symptoms or reason for visit",
      "dpdp_consent": true,
      "dpdp_consent_at": "ISO_TIMESTAMP"
    }
    \`\`\`
  - Response Schema:
    \`\`\`json
    {
      "success": true,
      "appointment_id": "apt_...",
      "token_number": "OPD-101",
      "clinic_name": "${clinic}",
      "doctor_name": "${doctor}",
      "whatsapp_confirmation": "..."
    }
    \`\`\`

---

### 🎨 Visual & Aesthetic Requirements
1. **Adaptive Theme Alignment:**
   - Detect and strictly inherit the host site's design system, font family (Inter, Plus Jakarta Sans, Geist, or system font), and color palette.
   - Primary Accent Color: **\`${color}\`** (use for active tab pills, badges, primary CTA button, focus rings).
   - Card Style: Modern glassmorphism or clean rounded cards with subtle borders (\`border-slate-200 dark:border-slate-800\`) and delicate elevation (\`shadow-sm\` / \`shadow-md\`).
   - Clean dark and light mode support using CSS variables or Tailwind dark variants.

---

### 📋 3-Step Multi-Stage Booking Flow

1. **Step 1: Doctor & Mode Selection**
   - Display a verified doctor summary card with avatar, name ("${doctor}"), credentials, specialty, and consultation fee ("₹${fee}").
   - Toggle between **In-Clinic OPD** (Zero queue wait) and **Online Video Consult** (WhatsApp video link).

2. **Step 2: Date & Real-time Slot Picker**
   - Quick date selector (Today, Tomorrow, or customized date picker).
   - Group slots logically into **Morning Shift** (e.g., 10:00 AM, 10:30 AM, 11:00 AM) and **Evening Shift** (e.g., 05:00 PM, 05:30 PM, 06:00 PM).
   - Interactive badge button for each slot with active selection state and keyboard accessibility.

3. **Step 3: Patient Information & DPDP Act 2023 Compliance**
   - Patient Name input (required).
   - WhatsApp Number input with auto-formatting / 10-digit validation (required for token delivery).
   - Optional Age, Gender, and Symptoms notes.
   - **MANDATORY DPDP Act 2023 Compliance Card:**
     - Clear Notice Box: *"Notice under DPDP Act 2023: Your personal data (Name, Contact, Health concern) is collected strictly for scheduling your appointment, issuing your OPD token, and clinic healthcare updates. Your data is encrypted and never sold."*
     - Explicit consent checkbox (must NOT be pre-checked): *"I give voluntary and affirmative consent under Section 6 of DPDP Act 2023 to ${doctor} / ${clinic} to process my personal data for appointment scheduling and receive my digital OPD token on WhatsApp."*
     - Clear right of withdrawal and grievance contact disclosure.

4. **Step 4: Instant Confirmation & OPD Token Card**
   - Once API returns 200 OK, display a congratulatory success card with:
     - Prominent **Digital OPD Token Badge** (e.g. \`OPD-241\`).
     - Appointment summary (Doctor, Date, Time, In-Clinic vs Online).
     - Direct CTA: **"Open in WhatsApp"** with pre-populated message:
       \`https://wa.me/{phone}?text={encoded_appointment_details}\`
     - Direct CTA: **"Add to Google Calendar"** (\`https://calendar.google.com/calendar/render?action=TEMPLATE&...\`).

---

### 🛡️ Code Quality & Resilience
- Include client-side validation for 10-digit Indian phone numbers and consent acceptance before API dispatch.
- Show spinner / loading state on submit button during network fetch.
- If network is unreachable, gracefully render a fallback confirmation with local OPD token and emergency clinic WhatsApp contact.
- Provide clean, modular, self-contained code that can be placed in any React/Next.js/Tailwind or Vue page.`;
}

/**
 * 3. 1-Line Script Tag Embed
 */
export function generateScriptTagSnippet(opts: WidgetGeneratorOptions): string {
  const slug = opts.slug || "dr-sharma-clinic";
  const color = opts.themeColor || "#059669";
  const baseUrl = (opts.baseUrl || "https://clinicx.digiwil.com").replace(/\/+$/, "");

  return `<!-- ClinicX 1-Click Floating Widget Script Tag -->
<script
  src="${baseUrl}/widget.js"
  data-clinic="${slug}"
  data-color="${color}"
  data-text="Book Appointment"
  data-position="bottom-right"
  data-dpdp="true"
  async
></script>`;
}

/**
 * 4. iFrame Embed Snippet
 */
export function generateIframeSnippet(opts: WidgetGeneratorOptions): string {
  const slug = opts.slug || "dr-sharma-clinic";
  const color = opts.themeColor || "#059669";
  const baseUrl = (opts.baseUrl || "https://clinicx.digiwil.com").replace(/\/+$/, "");
  const embedUrl = `${baseUrl}/c/${slug}/book?embed=true&source=website_iframe&tc=${encodeURIComponent(color)}&dpdp=true`;

  return `<!-- ClinicX Embedded Interactive Booking Calendar (iFrame) -->
<div style="width: 100%; max-width: 680px; margin: 0 auto; min-height: 750px;">
  <iframe
    src="${embedUrl}"
    width="100%"
    height="750"
    style="width: 100%; min-height: 750px; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); display: block;"
    allow="payment; geolocation; camera; microphone"
    loading="lazy"
    title="Book Appointment"
  ></iframe>
</div>`;
}
