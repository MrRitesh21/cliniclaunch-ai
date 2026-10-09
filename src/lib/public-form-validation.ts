import { z } from "zod";

/** Canonical phone is also the rate-budget and deduplication key. Indian mobile
 * aliases collapse; explicitly international E.164 numbers remain international.
 * Formatting characters are accepted, letters/extensions/control characters not.
 */
export function normalizePublicPhone(input: string): string | null {
  if (!/^[+0-9 ().-]{5,32}$/.test(input)) return null;
  let phone = input.replace(/[ ().-]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (/^[6-9]\d{9}$/.test(phone)) phone = "+91" + phone;
  else if (/^0[6-9]\d{9}$/.test(phone)) phone = "+91" + phone.slice(1);
  else if (/^0?91[6-9]\d{9}$/.test(phone)) phone = "+" + phone.replace(/^0/, "");
  return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : null;
}

export const publicPhoneSchema = z.string().trim().max(32).transform((value, ctx) => {
  const normalized = normalizePublicPhone(value);
  if (!normalized) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please enter a valid phone number, including country code for international numbers." });
    return z.NEVER;
  }
  return normalized;
});

export const publicNameSchema = z.string().trim().min(1, "Name is required").max(100)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Name contains invalid characters");

/** Require an offset-bearing timestamp. Date.parse alone silently accepts such
 * values as February 30; validate the calendar components as well. No future-only
 * policy: today's walk-ins and existing legitimate scheduling remain supported.
 */
export const publicTimestampSchema = z.string().max(40).refine((value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, ys, ms, ds, hs, mins, secs, offset] = match;
  const [year, month, day, hour, minute, second] = [ys, ms, ds, hs, mins, secs].map(Number);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > maxDay || hour > 23 || minute > 59 || second > 59) return false;
  if (offset !== "Z") {
    const [oh, om] = offset.slice(1).split(":").map(Number);
    if (oh > 14 || om > 59 || (oh === 14 && om !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}, "Please enter a valid appointment timestamp with timezone");
