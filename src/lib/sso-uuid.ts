/**
 * @module sso-uuid
 * @description Deterministic RFC4122 v4 compliant UUID generator for SSO sessions.
 * Guarantees valid UUID syntax for Postgres / PostgREST queries.
 */

export function emailToDeterministicUuid(email: string): string {
  const clean = (email || "doctor@clinicx.digiwil.com").trim().toLowerCase();
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 3812015801);
    h4 = Math.imul(h4 ^ ch, 2246822507);
  }
  const p1 = (h1 >>> 0).toString(16).padStart(8, "0").slice(0, 8);
  const p2 = (h2 >>> 16).toString(16).padStart(4, "0").slice(0, 4);
  const p3 = "4" + (h2 & 0x0fff).toString(16).padStart(3, "0").slice(0, 3);
  const p4 = ((h3 >>> 30) | 8).toString(16) + (h3 & 0x0fff).toString(16).padStart(3, "0").slice(0, 3);
  const p5 = ((h4 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 16).toString(16).padStart(4, "0")).slice(0, 12);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

export function isValidUuid(val: unknown): val is string {
  return typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}
