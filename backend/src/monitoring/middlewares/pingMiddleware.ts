import { Request, Response } from 'express';
import { LogService } from '../../logging';

/**
 * Ultra-fast Ping Handler (<5 ms latency)
 * Designed for high-frequency external uptime monitors (e.g. UptimeRobot, cron-job.org, GitHub Actions).
 * Bypasses database, Redis, authentication, and heavy middleware stack.
 */
export function pingHandler(req: Request, res: Response): void {
  const timestamp = new Date().toISOString();

  // Minimal async access log for audit
  LogService.debug(`[Ping] Endpoint checked from ${req.ip || 'unknown'}`);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).json({
    success: true,
    timestamp,
  });
}
