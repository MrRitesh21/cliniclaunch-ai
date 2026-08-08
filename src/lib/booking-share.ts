// Small utilities for the public booking success screen.
// Kept intentionally dependency-free.

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Format a Date into an all-UTC ICS timestamp: 20260705T101500Z */
function toIcsUtc(d: Date) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcsDataUrl(opts: {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  durationMinutes?: number;
  uid?: string;
}) {
  const end = new Date(opts.start.getTime() + (opts.durationMinutes ?? 30) * 60_000);
  const uid = opts.uid ?? `${Date.now()}-${Math.random().toString(36).slice(2)}@clinicx`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClinicX//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(opts.start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(opts.title)}`,
    opts.description ? `DESCRIPTION:${escapeIcs(opts.description)}` : "",
    opts.location ? `LOCATION:${escapeIcs(opts.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(lines.join("\r\n"));
}

/** Normalise a phone to digits for wa.me deeplinks. Empty string if no digits. */
export function normalizePhoneForWa(raw: string | null | undefined) {
  if (!raw) return "";
  return raw.replace(/[^\d]/g, "");
}

export function buildWhatsAppShareUrl(opts: { phone?: string | null; message: string }) {
  const digits = normalizePhoneForWa(opts.phone);
  const text = encodeURIComponent(opts.message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
