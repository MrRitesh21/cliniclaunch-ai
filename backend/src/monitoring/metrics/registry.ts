import { Registry, collectDefaultMetrics } from "prom-client";

// Create a custom registry to avoid global pollution
export const registry = new Registry();

// Collect default Node.js system and process metrics (Heap, RSS, CPU, Event Loop, GC)
collectDefaultMetrics({
  register: registry,
  prefix: "nodejs_",
});
