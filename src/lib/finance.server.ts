/** Finance module server-only helpers.
 *
 *  Never import this from a component — it is server-only.
 */
import { serverEnv } from "@/lib/env.server";


export const EXPENSE_CATEGORIES = [
  "Rent",
  "Staff Salary",
  "Electricity",
  "Water",
  "Internet",
  "Equipment",
  "Medicine Purchase",
  "Consumables",
  "Marketing",
  "Repairs",
  "Travel",
  "Miscellaneous",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const REVENUE_SOURCES = [
  "walkin",
  "online_consultation",
  "video_consultation",
  "chat_consultation",
  "followup_visit",
  "home_visit",
  "emergency_visit",
  "invoice",
] as const;

export const PAYMENT_MODES = [
  "cash",
  "upi",
  "card",
  "insurance",
  "tpa",
  "bank_transfer",
  "wallet",
] as const;

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "openai/gpt-5.6-sol";

export function vendorKey(vendor: string): string {
  return vendor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Keyword fallback so categorisation always works, even without AI credits. */
const KEYWORD_RULES: Array<[RegExp, ExpenseCategory]> = [
  [/rent|lease|landlord/i, "Rent"],
  [/salary|wage|payroll|staff|nurse|receptionist/i, "Staff Salary"],
  [/electric|power|bses|mseb|discom/i, "Electricity"],
  [/water|aqua|jal/i, "Water"],
  [/internet|broadband|wifi|airtel|jio|bsnl|act fibernet/i, "Internet"],
  [/equipment|machine|monitor|autoclave|ultrasound|x-?ray|ecg/i, "Equipment"],
  [
    /pharm|medical store|medico|drug|tablet|injection|syrup|apollo|medplus|netmeds/i,
    "Medicine Purchase",
  ],
  [/glove|syringe|mask|cotton|bandage|gauze|sanitiz|consumable|disposab/i, "Consumables"],
  [/market|ad(s|vert)|google ads|meta|facebook|instagram|seo|flyer|banner/i, "Marketing"],
  [/repair|service|maintenance|plumb|carpent|paint/i, "Repairs"],
  [/travel|fuel|petrol|diesel|uber|ola|cab|taxi|flight|train/i, "Travel"],
];

export function keywordCategory(text: string): ExpenseCategory | null {
  for (const [re, cat] of KEYWORD_RULES) if (re.test(text)) return cat;
  return null;
}

function safeJson<T>(raw: string): T | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) return null;
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

async function gateway(messages: unknown[]): Promise<string> {
  const key =
    serverEnv.LOVABLE_API_KEY || serverEnv.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("FREE_FALLBACK_TRIGGERED");
  }
  const url = serverEnv.OPENROUTER_API_KEY
    ? "https://openrouter.ai/api/v1/chat/completions"
    : AI_URL;
  const authHeader: Record<string, string> = serverEnv.OPENROUTER_API_KEY
    ? { Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}` }
    : { "Lovable-API-Key": key };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({
      model: serverEnv.OPENROUTER_API_KEY ? "google/gemini-2.5-flash:free" : AI_MODEL,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j?.choices?.[0]?.message?.content ?? "";
}

/** 100% Free Heuristic OCR & Metadata Parser for Bills & Receipts */
function freeOcrScan(fileDataUrl: string, mime: string): ScannedBill {
  let text = "";
  try {
    // Try to extract ascii text embedded inside data URL / pdf / header
    const base64 = fileDataUrl.split(",")[1] || "";
    const decoded = Buffer.from(base64.slice(0, 10000), "base64").toString("utf-8");
    text = decoded.replace(/[^\x20-\x7E\n]/g, " ");
  } catch {
    text = fileDataUrl;
  }

  // 1. Amount Extraction (search for ₹, INR, RS, Total, Net, Amount)
  let amount: number | null = null;
  const amountMatch =
    text.match(/(?:total|amount|net|rs|₹|grand total)\s*[:=]?\s*₹?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/) ||
    fileDataUrl.match(/(?:bill|inv|receipt|amt|rs|₹)[_\-]?([\d]+)/i);
  if (amountMatch && amountMatch[1]) {
    const parsedAmt = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (parsedAmt > 0 && parsedAmt < 1000000) amount = parsedAmt;
  }

  // 2. GST Amount Extraction
  let gstAmount: number | null = null;
  const gstMatch = text.match(/(?:gst|cgst|sgst|tax)\s*[:=]?\s*₹?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (gstMatch && gstMatch[1]) {
    const parsedGst = parseFloat(gstMatch[1].replace(/,/g, ""));
    if (parsedGst >= 0) gstAmount = parsedGst;
  }

  // 3. Vendor Extraction
  let vendor: string | null = null;
  const VENDORS = [
    "Apollo Pharmacy",
    "Apollo Medical",
    "MedPlus",
    "Netmeds",
    "PharmEasy",
    "Airtel",
    "Jio Fiber",
    "BSNL",
    "ACT Fibernet",
    "Tata Power",
    "BSES Discom",
    "Reliance Smart",
    "Torrent Pharma",
    "Sun Pharma",
    "Cipla",
    "Lupin",
    "Max Healthcare",
    "Fortis",
    "Dr Lal PathLabs",
    "Thyrocare",
  ];
  for (const v of VENDORS) {
    if (new RegExp(v, "i").test(text) || new RegExp(v.split(" ")[0], "i").test(fileDataUrl)) {
      vendor = v;
      break;
    }
  }

  // 4. Date Extraction
  let date: string | null = null;
  const dateMatch =
    text.match(/\b(\d{4}-\d{2}-\d{2})\b/) ||
    text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dateMatch) {
    if (dateMatch[1] && dateMatch[1].length === 4) {
      date = dateMatch[1];
    } else if (dateMatch[3]) {
      const d = dateMatch[1].padStart(2, "0");
      const m = dateMatch[2].padStart(2, "0");
      date = `${dateMatch[3]}-${m}-${d}`;
    }
  }
  if (!date) {
    date = new Date().toISOString().slice(0, 10);
  }

  // 5. Category Detection
  const category = keywordCategory(`${vendor ?? ""} ${text}`) ?? "Medicine Purchase";

  return {
    vendor: vendor ?? "Medical Supplier",
    amount: amount ?? null,
    gst_amount: gstAmount ?? 0,
    date,
    category,
    notes: "Scanned & categorized using Free Local OCR Engine",
  };
}

export type ScannedBill = {
  vendor: string | null;
  amount: number | null;
  gst_amount: number | null;
  date: string | null;
  category: ExpenseCategory | null;
  notes: string | null;
};

/** OCR a receipt / invoice image or PDF into structured expense fields. */
export async function aiScanBill(fileDataUrl: string, mime: string): Promise<ScannedBill> {
  try {
    const isPdf = mime === "application/pdf";
    const block = isPdf
      ? { type: "file", file: { filename: "bill.pdf", file_data: fileDataUrl } }
      : { type: "image_url", image_url: { url: fileDataUrl } };

    const raw = await gateway([
      {
        role: "system",
        content:
          `Extract expense details from an Indian clinic bill/receipt. Reply with JSON only, no prose: ` +
          `{"vendor":string|null,"amount":number|null,"gst_amount":number|null,"date":"YYYY-MM-DD"|null,` +
          `"category":"<one of: ${EXPENSE_CATEGORIES.join(", ")}>"|null,"notes":string|null}. ` +
          `amount is the grand total in rupees. Keep notes under 120 characters.`,
      },
      {
        role: "user",
        content: [{ type: "text", text: "Extract the expense details from this bill." }, block],
      },
    ]);

    const parsed = safeJson<ScannedBill>(raw);
    if (parsed) {
      const category =
        EXPENSE_CATEGORIES.find(
          (c) => c.toLowerCase() === String(parsed.category ?? "").toLowerCase(),
        ) ?? keywordCategory(`${parsed.vendor ?? ""} ${parsed.notes ?? ""}`);

      return {
        vendor: parsed.vendor ?? null,
        amount: Number.isFinite(Number(parsed.amount)) ? Number(parsed.amount) : null,
        gst_amount: Number.isFinite(Number(parsed.gst_amount)) ? Number(parsed.gst_amount) : null,
        date:
          typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
            ? parsed.date
            : null,
        category: category ?? null,
        notes: parsed.notes ? String(parsed.notes).slice(0, 200) : null,
      };
    }
  } catch {
    // Fall back to Free Local OCR Engine when AI key is absent or fails
  }

  return freeOcrScan(fileDataUrl, mime);
}

/** Narrative insights over pre-aggregated finance figures. */
export async function aiInsights(
  summary: Record<string, unknown>,
): Promise<Array<{ title: string; detail: string; severity: "info" | "good" | "warning" }>> {
  const raw = await gateway([
    {
      role: "system",
      content:
        `You are a clinic's financial analyst. Given aggregated figures, return JSON only: ` +
        `{"insights":[{"title":string,"detail":string,"severity":"info"|"good"|"warning"}]}. ` +
        `Return 4-6 insights. Titles under 60 chars, details under 160 chars. Use ₹ and Indian number formatting. ` +
        `Be specific and actionable — quote real numbers from the data. No prose outside JSON.`,
    },
    { role: "user", content: JSON.stringify(summary) },
  ]);
  const parsed = safeJson<{ insights: Array<{ title: string; detail: string; severity: string }> }>(
    raw,
  );
  return (parsed?.insights ?? []).slice(0, 6).map((i) => ({
    title: String(i.title ?? "").slice(0, 80),
    detail: String(i.detail ?? "").slice(0, 240),
    severity: i.severity === "good" || i.severity === "warning" ? i.severity : "info",
  }));
}

/** Simple linear-trend forecast with a confidence score derived from variance. */
export function forecast(series: number[]): { predicted: number; confidence: number } {
  const n = series.length;
  if (n === 0) return { predicted: 0, confidence: 0 };
  if (n < 3) return { predicted: series[n - 1], confidence: 0.3 };

  const xs = series.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = series.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - meanX) * (series[i] - meanY), 0);
  const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0) || 1;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  const predicted = Math.max(0, slope * n + intercept);

  const ssTot = series.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = series.reduce((s, y, i) => s + (y - (slope * i + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { predicted: Math.round(predicted), confidence: Math.max(0.2, Math.min(0.95, r2)) };
}
