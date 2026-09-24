import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { logger } from "../../logging/logger";
import { Request, Response } from "express";

// Extend Express Request type to support request_id, user_id, tenant_id
declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: { id?: string; tenant_id?: string; [key: string]: any };
      tenant_id?: string;
    }
  }
}

export const loggingMiddleware = pinoHttp({
  logger,
  genReqId: (req: Request) => {
    const existingId = req.headers["x-request-id"] as string;
    if (existingId) return existingId;
    return randomUUID();
  },
  autoLogging: {
    ignore: (req: Request) => {
      // Exclude /ping endpoint from full pino-http access logging to keep it high performance
      return req.url === "/ping";
    },
  },
  customProps: (req: Request, res: Response) => {
    return {
      request_id: req.id,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ip: req.ip || req.socket.remoteAddress || "unknown",
      user_agent: req.headers["user-agent"] || "unknown",
      user_id: req.user?.id || (req.headers["x-user-id"] as string) || undefined,
      tenant_id:
        req.tenant_id || req.user?.tenant_id || (req.headers["x-tenant-id"] as string) || undefined,
    };
  },
  customSuccessMessage: (req: Request, res: Response, responseTime: number) => {
    return `HTTP ${req.method} ${req.url} completed ${res.statusCode} in ${responseTime.toFixed(2)}ms`;
  },
  customErrorMessage: (req: Request, res: Response, error: Error) => {
    return `HTTP ${req.method} ${req.url} failed ${res.statusCode}: ${error.message}`;
  },
});
