/**
 * Process entry point: boot, background probes, graceful shutdown.
 *
 * Memory posture for Render Free: no clustering, no APM agent, no pretty-print
 * transport in production. Steady-state RSS for this service is ~55-70 MB, which
 * leaves the whole rest of the instance to the app.
 */
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closeRedis } from "./clients/redis.client.js";
import { recordBoot, startProbeScheduler } from "./health/health.service.js";
import { flushLogs, logger } from "./logging/logger.js";

const PROBE_INTERVAL_MS = 30_000;
const SHUTDOWN_GRACE_MS = 10_000;

const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(
    {
      host: env.HOST,
      port: env.PORT,
      version: env.SERVICE_VERSION,
      build: env.BUILD_NUMBER,
      commit: env.GIT_COMMIT,
      node: process.versions.node,
    },
    "observability service listening",
  );
});

// Keep sockets from accumulating on a free-tier box.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.maxRequestsPerSocket = 0;

const stopProbes = startProbeScheduler(PROBE_INTERVAL_MS);
void recordBoot();

let shuttingDown = false;

async function shutdown(signal: string, code = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  const force = setTimeout(() => {
    logger.error("graceful shutdown timed out, forcing exit");
    flushLogs();
    process.exit(code || 1);
  }, SHUTDOWN_GRACE_MS);
  force.unref();

  stopProbes();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeRedis();
  flushLogs();
  clearTimeout(force);
  process.exit(code);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error(
    {
      err:
        reason instanceof Error
          ? { message: reason.message, stack: reason.stack }
          : { value: String(reason) },
    },
    "unhandled rejection",
  );
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err: { message: err.message, stack: err.stack } }, "uncaught exception");
  void shutdown("uncaughtException", 1);
});
