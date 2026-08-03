// Standalone worker process runner for BullMQ
import { startWorkers, stopWorkers } from "../src/lib/queue/worker.js";

console.log("[Worker Process] Starting ClinicX BullMQ Background Workers...");
startWorkers();

const shutdown = async (signal) => {
  console.log(`[Worker Process] Received ${signal}, shutting down workers gracefully...`);
  try {
    await stopWorkers();
    console.log("[Worker Process] Workers stopped cleanly.");
    process.exit(0);
  } catch (err) {
    console.error("[Worker Process] Error during worker shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
