/**
 * Establishes the async request context and the `x-request-id` response header.
 * Runs before every other middleware so logs and metrics always correlate.
 */
import type { NextFunction, Request, Response } from "express";
import { Header } from "../../config/constants.js";
import { clientIp, truncate } from "../../utils/http.js";
import { newRequestId, runWithContext, type RequestContext } from "../context/request-context.js";

const INCOMING_ID_MAX = 128;

export function requestContextMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.headers[Header.requestId];
    const provided = Array.isArray(incoming) ? incoming[0] : incoming;
    const requestId =
      provided && provided.length > 0 && provided.length <= INCOMING_ID_MAX ? provided : newRequestId();

    const ctx: RequestContext = {
      requestId,
      method: req.method,
      url: truncate(req.originalUrl, 512),
      ip: clientIp(req),
      userAgent: truncate(req.headers["user-agent"], 256),
      tenantId: pickHeader(req, Header.tenantId),
      userId: pickHeader(req, Header.userId),
      startedAt: Date.now(),
    };

    res.setHeader(Header.requestId, requestId);
    res.locals['requestContext'] = ctx;
    runWithContext(ctx, () => next());
  };
}

function pickHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? truncate(raw, 64) : undefined;
}
