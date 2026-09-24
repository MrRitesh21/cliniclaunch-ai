import { Gauge, Histogram } from "prom-client";
import { registry } from "./registry";

// Redis Connectivity Status (1 = UP, 0 = DOWN)
export const redisUp = new Gauge({
  name: "redis_up",
  help: "Redis connection health status (1 = UP, 0 = DOWN)",
  registers: [registry],
});

// Redis Command Latency
export const redisCommandDurationSeconds = new Histogram({
  name: "redis_command_duration_seconds",
  help: "Latency of Redis operations in seconds",
  labelNames: ["command"],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [registry],
});
