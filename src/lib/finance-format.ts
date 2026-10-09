import { escapeHtml, sanitizeOutputHtml } from "./output-encoding";

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

export const compactInr = (n: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(n) || 0,
  );

export const PRETTY: Record<string, string> = {
  walkin: "Walk-in",
  online_consultation: "Online consultation",
  video_consultation: "Video consultation",
  chat_consultation: "Chat consultation",
  followup_visit: "Follow-up visit",
  home_visit: "Home visit",
  emergency_visit: "Emergency visit",
  invoice: "Invoiced billing",
  consultation: "Consultation fee",
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  insurance: "Insurance",
  tpa: "TPA",
  bank_transfer: "Bank transfer",
  wallet: "Wallet",
  unspecified: "Unspecified",
};

export const pretty = (k: string) =>
  PRETTY[k] ?? k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(160 60% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 60% 60%)",
  "hsl(200 80% 50%)",
  "hsl(350 70% 58%)",
  "hsl(100 45% 45%)",
];

/** Download rows as a CSV file. */
export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Spreadsheet formula triggers are strings only; retain real numeric values.
    if (typeof v === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Open a print-ready window (user picks "Save as PDF"). */
export function printReport(title: string, bodyHtml: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    body{font-family:ui-sans-serif,system-ui,sans-serif;padding:32px;color:#111}
    h1{font-size:20px;margin:0 0 4px} .sub{color:#666;font-size:12px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px}
    th,td{border-bottom:1px solid #e5e5e5;padding:8px 6px;text-align:left}
    th{background:#fafafa;text-transform:uppercase;font-size:10px;letter-spacing:.05em;color:#666}
    td.num,th.num{text-align:right}
    tfoot td{font-weight:700;border-top:2px solid #111}
  </style></head><body><h1>${escapeHtml(title)}</h1>
  <div class="sub">Generated ${new Date().toLocaleString("en-IN")}</div>
  ${sanitizeOutputHtml(bodyHtml)}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export function tableHtml(headers: string[], rows: Array<Array<string | number>>, numericFrom = 1) {
  const th = headers
    .map((h, i) => `<th class="${i >= numericFrom ? "num" : ""}">${escapeHtml(h)}</th>`)
    .join("");
  const tr = rows
    .map(
      (r) =>
        `<tr>${r.map((c, i) => `<td class="${i >= numericFrom ? "num" : ""}">${escapeHtml(c)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}
