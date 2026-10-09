import cors from "cors";
import type { RequestHandler } from "express";

/** Exact HTTP(S) origins only; no wildcard, credentials, path or opaque origin. */
function validOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password && url.origin === value;
  } catch { return false; }
}

export function createCorsBoundary(origins: readonly string[] = []): RequestHandler {
  const allowed = new Set(origins.filter(validOrigin));
  return (req, res, next) => {
    const origin = req.get("origin");
    // Express trust proxy remains false: forwarded host/proto are not authority.
    const sameOrigin = `${req.protocol}://${req.get("host")}`;
    res.vary("Origin");
    if (origin && (!validOrigin(origin) || (!allowed.has(origin) && origin !== sameOrigin))) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    cors({
      origin: origin || false,
      credentials: false,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-Tenant-ID", "X-User-ID"],
      maxAge: 600,
      optionsSuccessStatus: 204,
    })(req, res, next);
  };
}
