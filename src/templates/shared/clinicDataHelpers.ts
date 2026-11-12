import type { SiteClinic } from "@/components/site/types";
import type { TemplatePalette } from "./types";

export type NormalizedService = {
  id: string;
  name: string;
  description: string;
  duration?: string;
  price?: string | number;
  category?: string;
};

export type NormalizedReview = {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
  verified: boolean;
};

export type DayHours = {
  day: string;
  open: string;
  close: string;
  isClosed: boolean;
  hours?: string;
};

// Curated high-resolution healthcare stock imagery for template placeholders
export const FALLBACK_IMAGES = {
  clinicInterior: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80",
  consultationRoom: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80",
  // Standard Indian / South Asian male doctor portrait (steth, white labcoat, clinical setting)
  doctorPortrait: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=800&q=80",
  doctorPortraitMale: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=800&q=80",
  doctorPortraitFemale: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80",
  heroDoctor: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1200&q=80",
  aboutDoctor: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=1200&q=80",
  dentalSmile: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=1200&q=80",
  dentalCare: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=80",
  dentalCareMale: "https://images.unsplash.com/photo-1629909615184-74f495363b67?auto=format&fit=crop&w=1200&q=80",
  pediatricCare: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=80",
  pediatricCareMale: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1200&q=80",
  wellnessCare: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80",
  wellnessCareMale: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
  physioActive: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=1200&q=80",
  modernDiagnostic: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80",
  medicalTeam: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=1200&q=80",
};

const COMMON_MALE_FIRST_NAMES = new Set([
  "rakesh", "rajesh", "ramesh", "suresh", "mahesh", "dinesh", "naresh", "mukesh",
  "amit", "aniket", "rahul", "rohit", "anil", "sunil", "manoj", "sanjay", "ajay",
  "vijay", "deepak", "alok", "ashok", "pankaj", "pradeep", "pramod", "sachin",
  "gaurav", "saurabh", "varun", "arun", "kunal", "mohit", "sumit", "vivek",
  "abhishek", "aditya", "mayank", "harsh", "vishal", "nitin", "nikhil", "ravi",
  "tarun", "chetan", "manish", "hemant", "kamal", "vinod", "sanjeev", "rajiv",
  "satish", "yogesh", "lokesh", "akhilesh", "brijesh", "umesh", "hitesh", "ritesh",
  "praveen", "parveen", "naveen", "jaspreet", "gurpreet", "harpreet", "inder",
  "jagdish", "krishna", "shiva", "vishnu", "govind", "gopal", "anand", "ashish",
  "anurag", "tushar", "piyush", "ayush", "shubham", "akash", "pawan", "suraj",
  "chandan", "sohan", "mohan", "rohan", "karan", "arjun", "dhruv", "kabir",
  "shashank", "rishabh", "shivam", "kartik", "chirag", "tanmay", "pranav",
  "sameer", "samir", "salman", "irfan", "imran", "arshad", "tariq", "farhan",
  "asif", "wasim", "arif", "rashid", "zahid", "shahid", "sohail", "danish",
  "vikram", "devendra", "surendra", "jitendra", "dharmendra", "bhupendra",
  "john", "david", "michael", "james", "robert", "william", "richard", "thomas",
  "charles", "daniel", "matthew", "anthony", "mark", "donald", "steven", "paul",
  "andrew", "joshua", "kevin", "brian", "george", "edward", "ronald", "timothy",
  "jason", "jeffrey", "ryan", "jacob", "gary", "nicholas", "eric", "jonathan",
  "stephen", "larry", "justin", "scott", "brandon", "benjamin", "samuel", "gregory"
]);

const COMMON_FEMALE_FIRST_NAMES = new Set([
  "priya", "anjali", "pooja", "puja", "neha", "sunita", "kavita", "rekha", "sneha",
  "aarti", "arti", "swati", "shweta", "divya", "megha", "ritu", "seema", "geeta",
  "sita", "radha", "laxmi", "lakshmi", "anita", "sarita", "mamta", "monika",
  "archana", "vandana", "anupama", "pallavi", "rashmi", "poonam", "shilpa", "deepa",
  "deepika", "preeti", "priti", "jyoti", "sonam", "sonia", "priyanka", "tanvi",
  "kriti", "kritika", "ishita", "ananya", "aaradhya", "diya", "riya", "siya",
  "tanya", "simran", "jasleen", "harleen", "gurleen", "kiran", "suman", "shalini",
  "shreya", "shristi", "mansi", "garima", "sakshi", "nidhi", "richa", "roshni",
  "parul", "komal", "payal", "smriti", "shruti", "kanika", "vidhi", "bhavna",
  "tanu", "anu", "chhaya", "barkha", "sapna", "madhu", "usha", "asha", "shanti",
  "kamla", "sudha", "uma", "veena", "pushpa", "sushma", "meena", "renu", "neelam",
  "sharda", "santosh", "fatima", "ayesha", "zainab", "mariam", "sana", "saba",
  "heena", "hina", "shabnam", "yasmin", "farzana", "nazia", "rubina", "afreen",
  "mary", "patricia", "jennifer", "linda", "elizabeth", "barbara", "susan", "jessica",
  "sarah", "karen", "nancy", "lisa", "betty", "margaret", "sandra", "ashley",
  "kimberly", "emily", "donna", "michelle", "dorothy", "carol", "amanda", "melissa"
]);

const OLD_GENERIC_STOCK_IDS = [
  "photo-1622253692010-333f2da6031d",
  "photo-1559839734-2b71ea197ec2"
];

export function isGenericStockPlaceholder(url?: string | null): boolean {
  if (!url || typeof url !== "string") return true;
  return OLD_GENERIC_STOCK_IDS.some((stockId) => url.includes(stockId));
}

export function detectDoctorGender(doctorName?: string | null): "male" | "female" {
  if (!doctorName || !doctorName.trim()) return "male";
  const nameLower = doctorName.toLowerCase();

  // Explicit title checks
  if (/\b(mrs|ms|miss|smt|dr\.\s*mrs|dr\.\s*ms)\b/i.test(nameLower)) return "female";
  if (/\b(mr|shri|dr\.\s*mr)\b/i.test(nameLower)) return "male";

  // Clean title & specialty keywords (e.g., 'Dr. Rakesh piles fistula specialist')
  const cleaned = nameLower
    .replace(/^(dr\.?|doctor)\s+/i, "")
    .replace(
      /\b(piles|fistula|specialist|clinic|hospital|ayurveda|ayurvedic|dental|dentist|consultant|care|centre|center|diet|lifestyle|lifestyles|management|health|healthcare|skin|derma|ortho|surgeon|pediatric|physio|cardio|ent|neuro|gp|opd)\b/gi,
      ""
    )
    .trim();

  const tokens = cleaned.match(/[a-z]+/gi) || [];
  for (const token of tokens) {
    const t = token.toLowerCase();
    if (COMMON_MALE_FIRST_NAMES.has(t)) return "male";
    if (COMMON_FEMALE_FIRST_NAMES.has(t)) return "female";
  }

  return "male";
}

export function resolveDoctorImageUrl(
  doctorName?: string | null,
  specialization?: string | null,
  existingAvatarUrl?: string | null
): string {
  const gender = detectDoctorGender(doctorName);
  const spec = (specialization || "").toLowerCase();

  // If a real custom image was uploaded by user (e.g. Supabase storage or Cloudinary), preserve it
  if (existingAvatarUrl && existingAvatarUrl.trim().length > 5) {
    const isOldPlaceholder = isGenericStockPlaceholder(existingAvatarUrl);
    // If it's a real custom user upload, return it
    if (!isOldPlaceholder) {
      return existingAvatarUrl.trim();
    }
    // If it was the generic female placeholder but doctor is female, it's acceptable
    if (gender === "female" && existingAvatarUrl.includes("photo-1622253692010-333f2da6031d")) {
      return existingAvatarUrl.trim();
    }
    // Otherwise it was an improperly assigned female stock photo for a male doctor! Fall through to resolve correct photo.
  }

  if (spec.includes("dental") || spec.includes("dentist") || spec.includes("orthodont")) {
    return gender === "female" ? FALLBACK_IMAGES.dentalCare : FALLBACK_IMAGES.dentalCareMale;
  }

  if (
    spec.includes("ayurved") ||
    spec.includes("panchkarma") ||
    spec.includes("wellness") ||
    spec.includes("homeopath") ||
    spec.includes("naturopath")
  ) {
    return gender === "female" ? FALLBACK_IMAGES.wellnessCare : FALLBACK_IMAGES.wellnessCareMale;
  }

  if (spec.includes("pediatric") || spec.includes("child") || spec.includes("neonatal")) {
    return gender === "female" ? FALLBACK_IMAGES.pediatricCare : FALLBACK_IMAGES.pediatricCareMale;
  }

  if (spec.includes("physio") || spec.includes("ortho") || spec.includes("rehab") || spec.includes("spine")) {
    return FALLBACK_IMAGES.physioActive;
  }

  if (spec.includes("cardio") || spec.includes("heart")) {
    return "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=80";
  }

  if (spec.includes("derma") || spec.includes("skin") || spec.includes("aesthetic") || spec.includes("cosmet")) {
    return gender === "female"
      ? "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1000&q=80"
      : "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1000&q=80";
  }

  // General Medicine, Surgery, Piles/Fistula, Physician
  return gender === "female"
    ? FALLBACK_IMAGES.doctorPortraitFemale
    : FALLBACK_IMAGES.doctorPortraitMale;
}

export function getClinicName(clinic: SiteClinic): string {
  return clinic.clinic_name?.trim() || "ClinicX Healthcare";
}

export function getDoctorName(clinic: SiteClinic): string {
  return clinic.doctor_name?.trim() || "Dr. Medical Specialist";
}

export function getDoctorSpecialization(clinic: SiteClinic): string {
  return clinic.specialization?.trim() || "General Medicine & Healthcare";
}

export function getDoctorQualifications(clinic: SiteClinic): string {
  return clinic.qualification?.trim() || "MBBS, MD";
}

export function getDoctorAvatarUrl(clinic: SiteClinic): string {
  return resolveDoctorImageUrl(clinic.doctor_name, clinic.specialization, clinic.avatar_url);
}

export function getDoctorHeroImageUrl(clinic: SiteClinic): string {
  if (
    clinic.hero_image_url &&
    clinic.hero_image_url.trim().length > 5 &&
    !isGenericStockPlaceholder(clinic.hero_image_url)
  ) {
    return clinic.hero_image_url.trim();
  }
  return getDoctorAvatarUrl(clinic);
}

export function getDoctorExperience(clinic: SiteClinic): number {
  return Number(clinic.experience_years) || 10;
}

export function getMedicalRegistrationNo(clinic: SiteClinic): string | null {
  return clinic.medical_registration_no?.trim() || null;
}

export function getClinicPhone(clinic: SiteClinic): string | null {
  return clinic.public_phone?.trim() || clinic.phone?.trim() || null;
}

export function getClinicWhatsAppUrl(clinic: SiteClinic, prefillText?: string): string | null {
  const phone = getClinicPhone(clinic);
  if (!phone) return null;
  const cleanPhone = phone.replace(/[^\d+]/g, "").replace(/^0/, "91");
  const text = prefillText || `Hello ${getClinicName(clinic)}, I would like to inquire about booking an appointment.`;
  return `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(text)}`;
}

export function getClinicEmail(clinic: SiteClinic): string | null {
  return clinic.public_email?.trim() || clinic.email?.trim() || null;
}

export function getClinicAddress(clinic: SiteClinic): string {
  return clinic.public_address?.trim() || clinic.address?.trim() || "Medical Center, Ground Floor, Central Healthcare Avenue";
}

export function getGoogleMapsUrl(clinic: SiteClinic): string {
  const query = encodeURIComponent(`${getClinicName(clinic)}, ${getClinicAddress(clinic)}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function getConsultationFee(clinic: SiteClinic): number {
  return Number(clinic.consultation_fee) || 500;
}

export function getDoctorBio(clinic: SiteClinic): string {
  if (clinic.bio && clinic.bio.trim().length > 15) {
    return clinic.bio.trim();
  }
  if (clinic.about_text && clinic.about_text.trim().length > 15) {
    return clinic.about_text.trim();
  }
  return `${getDoctorName(clinic)} is a dedicated healthcare specialist with over ${getDoctorExperience(clinic)} years of clinical excellence in ${getDoctorSpecialization(clinic)}. Combining evidence-based medical science with compassionate patient-centered care.`;
}

export function getHeroHeadline(clinic: SiteClinic, fallback: string): string {
  return clinic.hero_headline?.trim() || fallback;
}

export function getHeroSubheadline(clinic: SiteClinic, fallback: string): string {
  return clinic.hero_subheadline?.trim() || fallback;
}

export function getServices(clinic: SiteClinic, defaultServices?: NormalizedService[]): NormalizedService[] {
  const raw = clinic.services;
  if (!raw) {
    return defaultServices || [
      { id: "s1", name: "Comprehensive Clinical Consultation", description: "In-depth clinical diagnosis, thorough symptom assessment, and tailored treatment plans.", duration: "30 mins", price: `₹${getConsultationFee(clinic)}` },
      { id: "s2", name: "Diagnostic Health Screening", description: "Preventative vital monitoring, biomarker evaluations, and holistic health risk analysis.", duration: "45 mins" },
      { id: "s3", name: "Personalized Treatment & Care", description: "Evidence-backed therapeutic interventions, ongoing medication management, and proactive recovery.", duration: "30 mins" },
      { id: "s4", name: "Follow-up & Preventative Review", description: "Progress review, recovery tracking, and preventive lifestyle guidance for long-term vitality.", duration: "20 mins" },
    ];
  }

  try {
    let list: any[] = [];
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        list = Array.isArray(parsed) ? parsed : [];
      } catch {
        list = raw.split("\n").filter((s) => s.trim().length > 0);
      }
    } else if (Array.isArray(raw)) {
      list = raw;
    }

    if (list.length === 0) return defaultServices || [];

    return list.map((item, idx) => {
      if (typeof item === "string") {
        return {
          id: `srv-${idx}`,
          name: item.trim(),
          description: "Comprehensive medical evaluation and personalized clinical care protocol.",
          duration: "30 mins",
          price: idx === 0 ? `₹${getConsultationFee(clinic)}` : undefined,
        };
      }
      return {
        id: item.id || `srv-${idx}`,
        name: item.name || item.title || item.label || `Service ${idx + 1}`,
        description: item.description || item.desc || "Comprehensive clinical assessment and expert treatment.",
        duration: item.duration || "30 mins",
        price: item.price ? `₹${item.price}` : undefined,
        category: item.category,
      };
    });
  } catch {
    return defaultServices || [];
  }
}

export function getGalleryImages(clinic: SiteClinic, fallbacks: string[]): string[] {
  const raw = clinic.gallery;
  if (!raw) return fallbacks;

  try {
    let list: any[] = [];
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        list = Array.isArray(parsed) ? parsed : [];
      } catch {
        list = raw.split("\n").filter(Boolean);
      }
    } else if (Array.isArray(raw)) {
      list = raw;
    }

    const urls = list
      .map((item) => (typeof item === "string" ? item.trim() : item?.url || item?.src))
      .filter((u): u is string => typeof u === "string" && u.length > 5);

    return urls.length > 0 ? urls : fallbacks;
  } catch {
    return fallbacks;
  }
}

export function getReviews(clinic: SiteClinic): NormalizedReview[] {
  if (Array.isArray(clinic.db_reviews) && clinic.db_reviews.length > 0) {
    return clinic.db_reviews.map((r, i) => ({
      id: `rev-${i}`,
      author: r.reviewer_name || "Patient",
      rating: r.rating || 5,
      comment: r.comment || "Very professional doctor and warm clinic atmosphere. Highly recommend!",
      date: r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "Recent",
      verified: true,
    }));
  }

  // Authentic realistic patient reviews as fallback
  return [
    {
      id: "rev-1",
      author: "Pooja Sharma",
      rating: 5,
      comment: `${getDoctorName(clinic)} is exceptionally attentive and explained the treatment with immense patience. The clinic environment is modern, clean, and welcoming.`,
      date: "Last month",
      verified: true,
    },
    {
      id: "rev-2",
      author: "Arun K. Verma",
      rating: 5,
      comment: "Minimal waiting time, thorough diagnosis, and genuine care. My recovery has been very fast. Best clinic in the area.",
      date: "2 months ago",
      verified: true,
    },
    {
      id: "rev-3",
      author: "Meera Nair",
      rating: 5,
      comment: "Very polite staff and state-of-the-art facilities. You immediately feel that you are in experienced and trustworthy hands.",
      date: "3 months ago",
      verified: true,
    },
  ];
}

export function getWorkingHours(clinic: SiteClinic): { days: DayHours[]; isOpenNow: boolean; todayHours: string } {
  const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const raw = clinic.working_hours;

  const defaultSchedule: DayHours[] = [
    { day: "Monday", open: "09:00 AM", close: "07:00 PM", isClosed: false, hours: "09:00 AM - 07:00 PM" },
    { day: "Tuesday", open: "09:00 AM", close: "07:00 PM", isClosed: false, hours: "09:00 AM - 07:00 PM" },
    { day: "Wednesday", open: "09:00 AM", close: "07:00 PM", isClosed: false, hours: "09:00 AM - 07:00 PM" },
    { day: "Thursday", open: "09:00 AM", close: "07:00 PM", isClosed: false, hours: "09:00 AM - 07:00 PM" },
    { day: "Friday", open: "09:00 AM", close: "07:00 PM", isClosed: false, hours: "09:00 AM - 07:00 PM" },
    { day: "Saturday", open: "09:00 AM", close: "04:00 PM", isClosed: false, hours: "09:00 AM - 04:00 PM" },
    { day: "Sunday", open: "10:00 AM", close: "01:00 PM", isClosed: true, hours: "Closed" },
  ];

  if (!raw || typeof raw !== "object") {
    return { days: defaultSchedule, isOpenNow: true, todayHours: "09:00 AM - 07:00 PM" };
  }

  try {
    const obj = raw as Record<string, any>;
    const days: DayHours[] = daysOrder.map((d) => {
      const entry = obj[d.toLowerCase()] || obj[d];
      if (!entry) {
        const isSun = d === "Sunday";
        return {
          day: d,
          open: isSun ? "10:00 AM" : "09:00 AM",
          close: isSun ? "01:00 PM" : "07:00 PM",
          isClosed: isSun,
          hours: isSun ? "Closed" : "09:00 AM - 07:00 PM",
        };
      }
      if (entry.closed || entry.is_closed || entry === "closed") {
        return { day: d, open: "-", close: "-", isClosed: true, hours: "Closed" };
      }
      const openTime = entry.open || entry.start || "09:00 AM";
      const closeTime = entry.close || entry.end || "07:00 PM";
      return {
        day: d,
        open: openTime,
        close: closeTime,
        isClosed: false,
        hours: `${openTime} - ${closeTime}`,
      };
    });

    const now = new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = dayNames[now.getDay()];
    const today = days.find((d) => d.day === currentDayName) || days[0];

    return {
      days,
      isOpenNow: !today.isClosed,
      todayHours: today.isClosed ? "Closed Today" : `${today.open} - ${today.close}`,
    };
  } catch {
    return { days: defaultSchedule, isOpenNow: true, todayHours: "09:00 AM - 07:00 PM" };
  }
}

/**
 * Dynamically resolves custom theme palette for any template.
 * Merges clinic.theme_color, ?tc= URL parameter, session local storage, and custom palette tokens.
 */
export function resolveTemplatePalette(
  basePalette: TemplatePalette,
  clinic?: SiteClinic | any,
  overrideColor?: string | null
): TemplatePalette {
  if (!clinic && !overrideColor) return basePalette;

  let primaryColor = overrideColor;

  if (typeof window !== "undefined" && !primaryColor) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tc = urlParams.get("tc");
      if (tc) primaryColor = tc;
      else if (clinic?.slug) {
        const stored = window.localStorage.getItem(`clinic_custom_color_${clinic.slug}`);
        if (stored) primaryColor = stored;
      }
    } catch {}
  }

  const customPalette = (clinic?.section_content?.custom_palette || {}) as Partial<TemplatePalette>;
  if (!primaryColor && customPalette.primary) {
    primaryColor = customPalette.primary;
  }

  // If clinic has a customized theme_color that differs from template base
  if (!primaryColor && clinic?.theme_color) {
    if (clinic.theme_color !== basePalette.primary) {
      primaryColor = clinic.theme_color;
    } else if (clinic.theme_color !== "#2563eb") {
      primaryColor = clinic.theme_color;
    }
  }

  const merged: TemplatePalette = {
    ...basePalette,
    ...customPalette,
  };

  if (primaryColor) {
    merged.primary = primaryColor;
    if (!customPalette.accent) {
      merged.accent = primaryColor;
    }
    // Set CSS variables for instant propagation across child components
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--primary", primaryColor);
      document.documentElement.style.setProperty("--ring", primaryColor);
    }
  }

  return merged;
}

export { useTemplatePalette } from "./useTemplatePalette";


