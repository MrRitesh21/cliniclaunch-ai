import React from "react";
import type { SiteClinic } from "@/components/site/types";
import type { PremiumTemplateId, TemplateDefinition, TemplateProps } from "./shared/types";

// Import all 10 dedicated premium templates
import { AuraCareTemplate } from "./aura-care/AuraCareTemplate";
import { PulseMotionTemplate } from "./pulse-motion/PulseMotionTemplate";
import { DentalAtelierTemplate } from "./dental-atelier/DentalAtelierTemplate";
import { TerraWellnessTemplate } from "./terra-wellness/TerraWellnessTemplate";
import { PrecisionMedicalTemplate } from "./precision-medical/PrecisionMedicalTemplate";
import { BloomPediatricsTemplate } from "./bloom-pediatrics/BloomPediatricsTemplate";
import { NoirSignatureTemplate } from "./noir-signature/NoirSignatureTemplate";
import { DigitalHealthTemplate } from "./digital-health/DigitalHealthTemplate";
import { LocalTrustTemplate } from "./local-trust/LocalTrustTemplate";
import { EditorialStudioTemplate } from "./editorial-studio/EditorialStudioTemplate";

export const PREMIUM_TEMPLATES: TemplateDefinition[] = [
  {
    id: "aura-care",
    name: "Aura Care",
    tagline: "Premium Minimal Healthcare",
    description:
      "Ivory backgrounds, deep navy typography, and muted sage accents. Elegant serif headlines paired with oversized editorial whitespace and calm clinical authority.",
    category: "general",
    categoryLabel: "General & Specialist",
    recommendedSpecialties: ["Private Clinics", "General Practitioners", "Internal Medicine", "Executive Health"],
    palette: {
      primary: "#52796f",
      secondary: "#0a192f",
      accent: "#84a98c",
      background: "#faf9f5",
      surface: "#ffffff",
      text: "#1b2a41",
      mutedText: "#55697d",
      border: "#e5dfd5",
    },
    typography: {
      headingFont: "Playfair Display / Serif",
      bodyFont: "Inter / Sans-Serif",
      styleDescription: "Calm, established, luxury editorial balance",
    },
    motionPhilosophy: "Cinematic text reveals, smooth image masks, subtle scroll-based underline animations",
    keyHighlights: ["Private Dossier Layout", "Gold Hairline Dividers", "Signature Badge", "Bespoke Scheduling"],
    swatchGradient: "linear-gradient(135deg, #faf9f5 0%, #52796f 50%, #0a192f 100%)",
    isPopular: true,
  },
  {
    id: "pulse-motion",
    name: "Pulse Motion",
    tagline: "Energetic Modern Healthcare",
    description:
      "Crisp white, cobalt blue, charcoal, and energetic lime accents. Directional graphic lines, asymmetric kinetic layouts, and sports recovery protocols.",
    category: "orthopedics",
    categoryLabel: "Sports Medicine & Orthopedics",
    recommendedSpecialties: ["Physiotherapy", "Sports Rehabilitation", "Orthopedic Clinics", "Active Living"],
    palette: {
      primary: "#1d4ed8",
      secondary: "#0f172a",
      accent: "#84cc16",
      background: "#ffffff",
      surface: "#ffffff",
      text: "#0f172a",
      mutedText: "#475569",
      border: "#e2e8f0",
    },
    typography: {
      headingFont: "Bold Kinetic Sans",
      bodyFont: "Inter / Sans-Serif",
      styleDescription: "High-energy athletic precision with monospace metrics",
    },
    motionPhilosophy: "Dynamic SVG pulse waves, staggered reveals, directional transitions, progress graphics",
    keyHighlights: ["EKG Motion Path", "Athletic Grid System", "Live Mobility Badges", "Movement Tracks"],
    swatchGradient: "linear-gradient(135deg, #1d4ed8 0%, #84cc16 60%, #0f172a 100%)",
    isNew: true,
  },
  {
    id: "dental-atelier",
    name: "Dental Atelier",
    tagline: "Modern Premium Dental",
    description:
      "Porcelain tones, bright white, ethereal pale blue, and restrained teal. Clean treatment showcases, genuine smile aesthetics, and sculptural rounded geometry.",
    category: "dental",
    categoryLabel: "Dental & Orthodontics",
    recommendedSpecialties: ["Dental Clinics", "Cosmetic Dentistry", "Orthodontists", "Smile Studios"],
    palette: {
      primary: "#0d9488",
      secondary: "#0f172a",
      accent: "#38bdf8",
      background: "#f8fafc",
      surface: "#ffffff",
      text: "#1e293b",
      mutedText: "#64748b",
      border: "#e2e8f0",
    },
    typography: {
      headingFont: "Modern Airy Sans",
      bodyFont: "Inter / Sans-Serif",
      styleDescription: "Porcelain-smooth tracking, clean treatment hierarchy",
    },
    motionPhilosophy: "Smile-inspired SVG curve drawing, gentle image reveals, circular brand motifs",
    keyHighlights: ["Smile Line Drawing", "Porcelain Cards", "Sterilization Showcase", "Comfort Protocol"],
    swatchGradient: "linear-gradient(135deg, #f0fdfa 0%, #0d9488 50%, #0f172a 100%)",
    isPopular: true,
  },
  {
    id: "terra-wellness",
    name: "Terra Wellness",
    tagline: "Warm Organic Wellness",
    description:
      "Warm ivory, terracotta, forest spruce, and soft sand. Editorial serif typography, natural human-centered photography, and botanical curves.",
    category: "ayurvedic",
    categoryLabel: "Holistic & Wellness",
    recommendedSpecialties: ["Integrative Medicine", "Ayurvedic Clinics", "Holistic Wellness", "Mind-Body Centers"],
    palette: {
      primary: "#c2410c",
      secondary: "#14532d",
      accent: "#ea580c",
      background: "#fcfbf7",
      surface: "#ffffff",
      text: "#292524",
      mutedText: "#57534e",
      border: "#e7e0d3",
    },
    typography: {
      headingFont: "Warm Literary Serif",
      bodyFont: "Inter / Sans-Serif",
      styleDescription: "Warm earth-toned editorial layout with botanical accents",
    },
    motionPhilosophy: "Organic image masks, hand-drawn curves, slow restrained section transitions",
    keyHighlights: ["Apothecary Service List", "Botanical SVG Curves", "Gentle Parallax", "Natural Harmony"],
    swatchGradient: "linear-gradient(135deg, #fcfbf7 0%, #c2410c 50%, #14532d 100%)",
  },
  {
    id: "precision-medical",
    name: "Precision Medical",
    tagline: "Structured Clinical Professional",
    description:
      "Hospital clinical white, surgical navy, steel blue, and restrained red accents. Swiss-style structured grid, clear medical registration, and clinical indexes.",
    category: "general",
    categoryLabel: "Multispecialty & Hospital",
    recommendedSpecialties: ["Multispecialty Hospitals", "Orthopedics", "Cardiology", "Diagnostic Centers"],
    palette: {
      primary: "#0f172a",
      secondary: "#dc2626",
      accent: "#334155",
      background: "#ffffff",
      surface: "#f8fafc",
      text: "#0f172a",
      mutedText: "#475569",
      border: "#0f172a",
    },
    typography: {
      headingFont: "Structured Tabular Sans",
      bodyFont: "Inter / Sans-Serif",
      styleDescription: "High-contrast clinical Swiss alignment with monospaced metadata",
    },
    motionPhilosophy: "Fine technical grid lines, precise tabular reveals without overshoot",
    keyHighlights: ["Swiss Grid Alignment", "Council Registration Badges", "Service Code Index", "Emergency Protocols"],
    swatchGradient: "linear-gradient(135deg, #ffffff 0%, #0f172a 60%, #dc2626 100%)",
  },
  {
    id: "bloom-pediatrics",
    name: "Bloom Pediatrics",
    tagline: "Friendly Family Healthcare",
    description:
      "Warm white, sky blue, soft coral, and gentle yellow. Friendly child-approved shapes, welcoming family photography, and interactive parent guidance FAQs.",
    category: "pediatrics",
    categoryLabel: "Pediatrics & Child Care",
    recommendedSpecialties: ["Pediatric Clinics", "Child Wellness", "Family Medicine", "Vaccination Centers"],
    palette: {
      primary: "#fb7185",
      secondary: "#0284c7",
      accent: "#facc15",
      background: "#fffdfa",
      surface: "#ffffff",
      text: "#1e293b",
      mutedText: "#64748b",
      border: "#ffe4e6",
    },
    typography: {
      headingFont: "Approachable Rounded Sans",
      bodyFont: "Inter / Sans-Serif",
      styleDescription: "Warm, reassuring, parent-friendly typography",
    },
    motionPhilosophy: "Soft shape transitions, gentle bobbing icons, friendly page reveals, smooth FAQ accordion",
    keyHighlights: ["Parent FAQ Resource", "Vaccine Safety Badges", "Warm Cloud Shapes", "Zero-Wait Pediatric OPD"],
    swatchGradient: "linear-gradient(135deg, #fffdfa 0%, #fb7185 50%, #0284c7 100%)",
    isPopular: true,
  },
  {
    id: "noir-signature",
    name: "Noir Signature",
    tagline: "Luxury Specialist Practice",
    description:
      "Warm cream and ivory backgrounds, deep charcoal text with restrained bronze and champagne accents. High-fashion medical editorial with discrete VIP privacy.",
    category: "dermatology",
    categoryLabel: "Dermatology & Luxury Aesthetics",
    recommendedSpecialties: ["Aesthetic Medicine", "Dermatology", "Plastic Surgery", "Private Executive Care"],
    palette: {
      primary: "#18181b",
      secondary: "#c5a059",
      accent: "#d4af37",
      background: "#faf8f5",
      surface: "#ffffff",
      text: "#18181b",
      mutedText: "#57534e",
      border: "#e7e2d8",
    },
    typography: {
      headingFont: "High-Fashion Editorial Serif",
      bodyFont: "Inter / Sans-Serif",
      styleDescription: "Understated champagne tracking, gold hairline dividers",
    },
    motionPhilosophy: "Slow cinematic curtain reveal, gold hairline line expansion, understated button transitions",
    keyHighlights: ["Private Consulting Suite", "VIP Dossier Portfolio", "Concierge WhatsApp Desk", "Discreet Luxury"],
    swatchGradient: "linear-gradient(135deg, #faf8f5 0%, #c5a059 50%, #18181b 100%)",
    isNew: true,
  },
  {
    id: "digital-health",
    name: "Digital Health",
    tagline: "Contemporary Tech-Enabled Care",
    description:
      "Bright white, electric indigo, cyber cyan, and lavender accents. Modular bento grid layout, interactive In-Clinic vs Video selector, and real-time sync.",
    category: "general",
    categoryLabel: "Telehealth & Connected Care",
    recommendedSpecialties: ["Digital Health Startups", "Hybrid Practices", "Tele-Consultations", "Modern Polyclinics"],
    palette: {
      primary: "#4f46e5",
      secondary: "#06b6d4",
      accent: "#a855f7",
      background: "#fcfdff",
      surface: "#ffffff",
      text: "#0f172a",
      mutedText: "#475569",
      border: "#e2e8f0",
    },
    typography: {
      headingFont: "Neo-Grotesque Tech Sans",
      bodyFont: "Inter / Sans-Serif",
      styleDescription: "Clean, digital-native typography with terminal status pills",
    },
    motionPhilosophy: "Animated SVG telemetry, dynamic live pulse indicators, bento grid stagger entrance",
    keyHighlights: ["In-Clinic vs Video Toggle", "3-Step Digital Journey", "Real-Time Telemetry Bar", "60-Second Booking"],
    swatchGradient: "linear-gradient(135deg, #fcfdff 0%, #4f46e5 50%, #06b6d4 100%)",
  },
  {
    id: "local-trust",
    name: "Local Trust",
    tagline: "Community Clinic & Conversion Focus",
    description:
      "Warm white backgrounds, accessible high-contrast typography, and healing emerald accents. Prominent click-to-call, clinic timings, and fast driving directions.",
    category: "general",
    categoryLabel: "Neighborhood Family Practice",
    recommendedSpecialties: ["Family Doctors", "Neighborhood Clinics", "General Practitioners", "Small Polyclinics"],
    palette: {
      primary: "#059669",
      secondary: "#047857",
      accent: "#10b981",
      background: "#fafaf9",
      surface: "#ffffff",
      text: "#1c1917",
      mutedText: "#57534e",
      border: "#e7e5e4",
    },
    typography: {
      headingFont: "High-Legibility Accessible Sans",
      bodyFont: "Inter / Sans-Serif",
      styleDescription: "Unmistakable bold contact points, large touch targets",
    },
    motionPhilosophy: "Fast, subtle entrance transitions, tactile button ripple, smooth FAQ expansion",
    keyHighlights: ["Direct Call Action", "Google Maps Navigation", "Walk-In Info Notice", "Neighborhood Trust Score"],
    swatchGradient: "linear-gradient(135deg, #fafaf9 0%, #059669 60%, #047857 100%)",
    isPopular: true,
  },
  {
    id: "editorial-studio",
    name: "Editorial Studio",
    tagline: "Bold Creative Art Direction",
    description:
      "Museum off-white, stark ink black, and cobalt accents. Avant-garde asymmetric grids, large typographic statements, Roman numeral sections, and narrative rhythm.",
    category: "general",
    categoryLabel: "Brand-Conscious Medical Studio",
    recommendedSpecialties: ["Brand-Conscious Clinics", "Physiotherapy Studios", "Dental Studios", "Modern Specialists"],
    palette: {
      primary: "#111111",
      secondary: "#2563eb",
      accent: "#d97706",
      background: "#f7f6f2",
      surface: "#ffffff",
      text: "#111111",
      mutedText: "#444444",
      border: "#e5e4de",
    },
    typography: {
      headingFont: "Avant-Garde Architectural Serif",
      bodyFont: "Space Grotesk / Mono",
      styleDescription: "Oversized mixed-scale headlines, roman numeral section markers",
    },
    motionPhilosophy: "GSAP scroll-triggered text reveals, asymmetric parallax card shifts, fine hairline grid reveals",
    keyHighlights: ["Architectural Manifesto", "Roman Numeral Disciplines", "Mixed Image Scale", "Full-Bleed Lead Profile"],
    swatchGradient: "linear-gradient(135deg, #f7f6f2 0%, #111111 60%, #2563eb 100%)",
    isNew: true,
  },
];

export const TEMPLATE_COMPONENTS: Record<PremiumTemplateId, React.ComponentType<TemplateProps>> = {
  "aura-care": AuraCareTemplate,
  "pulse-motion": PulseMotionTemplate,
  "dental-atelier": DentalAtelierTemplate,
  "terra-wellness": TerraWellnessTemplate,
  "precision-medical": PrecisionMedicalTemplate,
  "bloom-pediatrics": BloomPediatricsTemplate,
  "noir-signature": NoirSignatureTemplate,
  "digital-health": DigitalHealthTemplate,
  "local-trust": LocalTrustTemplate,
  "editorial-studio": EditorialStudioTemplate,
};

export function isPremiumTemplate(id: string | null | undefined): id is PremiumTemplateId {
  if (!id) return false;
  return id in TEMPLATE_COMPONENTS;
}

export function getPremiumTemplateDefinition(id: string): TemplateDefinition | undefined {
  return PREMIUM_TEMPLATES.find((t) => t.id === id);
}

export function getPremiumTemplateComponent(id: string): React.ComponentType<TemplateProps> | null {
  return TEMPLATE_COMPONENTS[id as PremiumTemplateId] || null;
}
