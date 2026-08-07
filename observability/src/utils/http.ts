import type { Request } from "express";
import { Header } from "../config/constants.js";

/** First hop of X-Forwarded-For, falling back to the socket address. */
export function clientIp(req: Request): string {
  const forwarded = req.headers[Header.forwardedFor];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

/**
 * Route template for metric labels. Express fills `req.route.path` only after
 * routing, so we compose it with the mounted base path; unmatched requests
 * collapse to a single `unmatched` label instead of exploding cardinality.
 */
export function routeTemplate(req: Request): string {
  const route = (req.route as { path?: string } | undefined)?.path;
  if (!route) return "unmatched";
  const base = req.baseUrl || "";
  const path = `${base}${route === "/" ? "" : route}`;
  return path || "/";
}

export function responseBytes(headerValue: string | number | string[] | undefined): number {
  if (typeof headerValue === "number") return headerValue;
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function truncate(value: string | undefined, max = 256): string {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
