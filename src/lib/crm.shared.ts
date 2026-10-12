/**
 * @module crm.shared
 * @description Client-safe synchronous pitch generator and demo URL utilities.
 * Allows 0ms instant pitch drafting and stage switching without network lag.
 */

export type PitchToneKey =
  | "app_store_comprehensive"
  | "hourly_followup_1"
  | "hourly_followup_2"
  | "hourly_followup_3"
  | "hourly_followup_4"
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
    case "app_store_comprehensive":
      return `Namaste ${dName} sir! 🙏
Ritesh here, founder of ClinicX.

Hope aapka OPD schedule smoothly chal raha hai. Mene notice kiya aap${city} me ${specialty} practice operate kar rahe hain (${cName}).

Sir, mostly OPDs me humne dekha hai ki doctors patient consultation me deeply engaged hote hain, lekin receptionist ke miss hone ya phone busy hone ki wajah se 40%+ prospective patients slip ho jaate hain. Saath hi paper prescriptions aur OPD waiting room ka rush doctors ka daily 2 se 3 ghante administrative tension me le leta hai.

Isi problem ko solve karne ke liye humne *ClinicX App Store* develop kiya hai — ek complete all-in-one ecosystem jisme zero software install karna padta hai aur sab kuch directly aapke WhatsApp & phone par chalta hai.

Aapke clinic ke liye hamare core apps kaise help karenge:

🏥 *1. 24/7 WhatsApp AI Receptionist*
• Kaam: Jab aap consultation me busy hote hain ya raat ko clinic band hota hai, ye AI automatically patient ki Hindi/English queries ka instant reply deta hai aur slot confirm karta hai.
• Fayda: Zero missed inquiries, 24/7 auto appointments, receptionist par dependence khatam.

✍️ *2. 30-Second E-Prescription Studio (WhatsApp PDF)*
• Kaam: 50,000+ Indian generic & brand medicine directory ke sath 30 seconds me neat digital prescription tayar hota hai, aur 1-tap me patient ke WhatsApp par clinic logo ke sath deliver ho jata hai.
• Fayda: Paper slips khone ka jhanjhat khatam, permanent EMR record, OPD turnover 2x fast.

🎫 *3. Walk-in QR & Live Token Queue Display*
• Kaam: Clinic entrance par ek simple QR standee lagta hai. Walk-in patients scan karke live token number le lete hain aur unke WhatsApp par alert aata hai jab unka number aane wala hota hai.
• Fayda: Reception par bheed aur shor-sharaba zero, patients comfortable rehte hain.

⏰ *4. Automated Patient Follow-up & Refill Engine*
• Kaam: Consultation ke 3 din baad recovery check-up aur chronic patients ke liye 30-day medicine refill alert WhatsApp par automatically chala jata hai.
• Fayda: Patient care continuous rehti hai aur revisits 35% badh jaate hain without staff making calls.

⭐ *5. Google Reviews & Local SEO Booster*
• Kaam: OPD consultation ke theek baad happy patients ko 5-star Google review ka direct link auto-send hota hai. Negative feedback privately filter ho jata hai.
• Fayda: 60 din ke andar clinic Google Maps aur search par #1 rank karne lagta hai.

📊 *6. Daily OPD Collection Ledger & Billing*
• Kaam: Cash, UPI aur card consultation fees ka automatic hisab. Raat ko complete day summary direct aapke personal WhatsApp par aa jati hai.
• Fayda: Staff se hisab maangne ki jarurat nahi, zero cash leakages.

━━━━━━━━━━━━━━━━━━━━━━━━━━
Maine aapke clinic (${cName}) ke liye ek personalized interactive live demo portal tayar kiya hai sir:
👉 ${demoLink}

Is link par click karke aap khud dekh sakte hain ki ye aapke OPD me kitna time bachayega.

Koi hard-selling ya upfront payment nahi hai sir — 14 days ka complete free trial hai with zero setup fee. Jab aapke paas 2 minute ka free time ho, link ek baar open karke dekhiyega sir.

Agar koi bhi question ho ya setup me help chahiye ho to mujhe yahi WhatsApp par batayein! 🙏`;

    case "hourly_followup_1":
      return `Namaste ${dName} sir! 🙏
Ritesh here again from ClinicX.

Mujhe pata hai sir aap abhi OPD consultations me busy honge patients ke sath.
Sirf ek quick observation share karna chahta tha: ज्यादातर doctors jo ClinicX use kar rahe hain unhone bataya ki OPD rush ke time unka staff calls attend nahi kar pata tha.
Hamare WhatsApp AI se patients khud 10 second me slot choose kar lete hain aur confirmation pa lete hain.

Aap jab bhi free hon to aapka customized demo link zaroor dekhein sir:
👉 ${demoLink}

Aapka routine disturb nahi karna chahta, jab fursat mile tab check kijiyega!`;

    case "hourly_followup_2":
      return `${dName} sir, pranam 🙏
Quick update regarding ${cName}:

Mene demo link me aapke specialty (${specialty}) ke customized 30-second digital prescription templates bhi configure kar diye hain.
Aap voice-to-text ya 1-tap se complete Rx patient ke WhatsApp par PDF format me bhej sakte hain:
👉 ${demoLink}

Paper slips likhne ka daily 1 ghanta bachega aur OPD consultation speed 2x smooth ho jayegi sir.`;

    case "hourly_followup_3":
      return `Namaste ${dName} sir!
Ritesh from ClinicX.

Ek small insight share karni thi: Hamara review booster automatically OPD ke baad satisfied patients se Google 5-star reviews collect karta hai. Isse local area${city} me clinic search me top par aane lagta hai.

Aapke clinic ke live setup ka preview:
👉 ${demoLink}

Sir agar aap chahein to aaj shaam ko 5 minute me aapka live testing setup activate karwa deta hoon, completely free.`;

    case "hourly_followup_4":
      return `${dName} sir, Namaste 🙏
Hope OPD achhi rahi aaj ki!

Sir mai samajh sakta hoon clinic chalana aur continuous patients dekhna kitna demanding hota hai, aur messages check karne ka time nahi mil pata.
Bas ek baar confirm karna chahta tha kya demo link open ho pa raha hai?
👉 ${demoLink}

Agar aap busy hain to koi baat nahi sir, jab bhi comfortable ho ek chhota sa 'Hi' bhej dijiye, mai detailed walkthrough setup karwa dunga.`;

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
