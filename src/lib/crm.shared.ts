/**
 * @module crm.shared
 * @description Client-safe synchronous pitch generator and demo URL utilities.
 * Allows 0ms instant pitch drafting and stage switching without network lag.
 */

export type PitchToneKey =
  | "warm_intro"
  | "demo_delivery"
  | "opd_problem_solver"
  | "followup_1"
  | "followup_2"
  | "closing_offer";

export function getClientDemoUrl(
  optsOrDoctorName?:
    | {
        doctorName?: string | null;
        clinicName?: string | null;
        specialty?: string | null;
        city?: string | null;
      }
    | string
    | null,
  clinicName?: string | null,
  specialty?: string | null,
  city?: string | null
): string {
  let doc = "Dr. Partner";
  let cln = "Excellence Clinic";
  let spec = "General Medicine";
  let ct = "New Delhi";

  if (typeof optsOrDoctorName === "object" && optsOrDoctorName !== null) {
    doc = optsOrDoctorName.doctorName || doc;
    cln = optsOrDoctorName.clinicName || cln;
    spec = optsOrDoctorName.specialty || spec;
    ct = optsOrDoctorName.city || ct;
  } else if (typeof optsOrDoctorName === "string") {
    doc = optsOrDoctorName || doc;
    cln = clinicName || cln;
    spec = specialty || spec;
    ct = city || ct;
  }

  const d = encodeURIComponent(doc);
  const c = encodeURIComponent(cln);
  const s = encodeURIComponent(spec);
  const cty = encodeURIComponent(ct);
  return `https://clinicx.digiwil.com/c/demo?doctor=${d}&clinic=${c}&specialty=${s}&city=${cty}&ref=crm`;
}

export function getInstantFounderPitch(opts: {
  doctorName: string;
  clinicName?: string | null;
  city?: string | null;
  specialty?: string | null;
  tone: PitchToneKey;
  demoUrl?: string | null;
}): string {
  const dName = opts.doctorName.startsWith("Dr.") ? opts.doctorName : `Dr. ${opts.doctorName}`;
  const cName = opts.clinicName || "aapke clinic";
  const city = opts.city ? ` in ${opts.city}` : "";
  const specialty = opts.specialty || "practice";
  const demoLink = opts.demoUrl || getClientDemoUrl({
    doctorName: dName,
    clinicName: cName,
    specialty,
    city: opts.city,
  });

  switch (opts.tone) {
    case "warm_intro":
      return `Namaste ${dName} sir! 🙏
Ritesh here, founder of ClinicX.

Mene dekha aap${city} me ${specialty} run kar rahe hain. 
Sir, mostly clinics me problem aati hai ki OPD consultation ke waqt patients ke WhatsApp appointment messages miss ho jate hain ya staff late reply karta hai.

Humne doctors ke liye ek 24/7 WhatsApp AI Receptionist & Instant E-Prescription system develop kiya hai.
Maine ${cName} ke liye ek 2-minute live interactive demo ready kiya hai:
👉 ${demoLink}

Ek baar dekh lijiye sir. Agar pasand aaye to batayein, 5 min me aapka WhatsApp connect karwa dunga!`;

    case "demo_delivery":
      return `Hi ${dName} ji, Ritesh here from ClinicX 👋

Aapke clinic (${cName}) ka live personalized demo portal ready ho gaya hai:
👉 ${demoLink}

Is link par click karke aap check kar sakte hain:
1. Patient WhatsApp se instant appointment kaise book karega
2. Automatic WhatsApp reminders kaise jayenge
3. Digital Rx aur Walk-in QR counter kaise kaam karta hai

Koi bhi question ho to mujhe yahi WhatsApp par batayein sir!`;

    case "opd_problem_solver":
      return `Pranam ${dName} sir, Ritesh here (ClinicX).

Sir kya aapke clinic me patients ko waiting room me lambe queues me rukna padta hai, ya staff ko bar-bar appointment calls attend karni padti hain?

ClinicX aapke clinic ke WhatsApp ko auto-pilot par daal deta hai:
✅ 24/7 Instant Appointment Booking
✅ Automated Reminders (80% No-show drop)
✅ 1-Tap Digital Prescriptions on WhatsApp
✅ DPDP Act 2023 Compliant Indian Servers

Aapke clinic ka live preview yaha hai:
👉 ${demoLink}

Abhi 14 din ka free trial chal raha hai sir, with zero setup fees.`;

    case "followup_1":
      return `Namaste ${dName} sir! Hope your OPD was smooth today 🙏
Ritesh here from ClinicX.

Just wanted to check kya aapko live demo link dekhne ka time mila?
Link: ${demoLink}

Sir, aapki specialty (${specialty}) ke liye hamare paas customized OPD workflows hain. Agar aapke paas 5 min ho to mai call par quick walkthrough de sakta hoon?`;

    case "followup_2":
      return `${dName} sir, ek quick update share karna chahta tha!
Recently hamare platform se jud kar 15+ clinics ne WhatsApp booking start ki hai, aur unka daily 2 ghante staff ka time bach raha hai.

Maine aapke clinic (${cName}) ke liye free VIP onboarding slot hold kiya hua hai:
👉 ${demoLink}

Aap batayein to aaj evening 5 baje aapka setup 5 minutes me live karwa dein?`;

    case "closing_offer":
      return `Namaste ${dName} sir! 
This week hum select doctors ke liye special Clinic Launch Kit provide kar rahe hain:
✨ Lifetime free domain setup
✨ Google Maps & Local SEO boost
✨ Dedicated WhatsApp Bot integration
✨ 1-on-1 staff training

Agar aap interested hain to mujhe 'YES' reply kar dijiye sir, mai immediate workspace activate kar deta hoon.`;

    default:
      return `Hi ${dName} sir, Ritesh here from ClinicX. Here is your live clinic demo: ${demoLink}`;
  }
}
