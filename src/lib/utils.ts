import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Cleanly parses and sanitizes clinical problem / chief complaint strings,
 * stripping accidental [object Object] artifacts and extracting tagged services.
 */
export function cleanProblemAndService(rawProblem: unknown): {
  service: string;
  problem: string;
  displaySummary: string;
} {
  if (!rawProblem) {
    return { service: "", problem: "", displaySummary: "" };
  }

  let text = "";
  if (typeof rawProblem === "string") {
    text = rawProblem;
  } else if (typeof rawProblem === "object") {
    const obj = rawProblem as Record<string, any>;
    text = obj.name || obj.problem || obj.symptoms || obj.service || "";
  } else {
    text = String(rawProblem);
  }

  // Strip literal [object Object] (including bracketed forms and case variations)
  let cleaned = text
    .replace(/\[\s*object\s+Object\s*\]/gi, "")
    .replace(/object\s+Object/gi, "")
    .trim();

  let service = "";
  // Check for [Service: ...] prefix
  const serviceMatch = cleaned.match(/^\[Service:\s*([^\]]+)\]/i);
  if (serviceMatch) {
    const candidate = serviceMatch[1].trim();
    if (candidate && !candidate.toLowerCase().includes("object")) {
      service = candidate;
    }
    cleaned = cleaned.replace(/^\[Service:\s*[^\]]*\]/i, "").trim();
  }

  // Strip any lingering brackets or punctuation artifacts at boundaries
  cleaned = cleaned
    .replace(/^[\]\)\}\-\:\s]+/, "")
    .replace(/[\[\(\{\-\:\s]+$/, "")
    .trim();

  let displaySummary = "";
  if (service && cleaned) {
    displaySummary = `${service} • ${cleaned}`;
  } else if (service) {
    displaySummary = service;
  } else if (cleaned) {
    displaySummary = cleaned;
  }

  return { service, problem: cleaned, displaySummary };
}

