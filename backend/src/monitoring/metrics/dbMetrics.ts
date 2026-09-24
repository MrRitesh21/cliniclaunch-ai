import { Gauge, Histogram } from "prom-client";
import { registry } from "./registry";

// Supabase / Database Connectivity Status (1 = UP, 0 = DOWN)
export const databaseUp = new Gauge({
  name: "database_up",
  help: "Database connection health status (1 = UP, 0 = DOWN)",
  registers: [registry],
});

// Database Query Duration
export const databaseQueryDurationSeconds = new Histogram({
  name: "database_query_duration_seconds",
  help: "Latency of database queries in seconds",
  labelNames: ["operation", "table"],
  buckets: [0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});
