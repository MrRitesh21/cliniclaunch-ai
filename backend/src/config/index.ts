import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export interface AppConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  appVersion: string;
  buildNumber: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  redisUrl: string;
  slowRequestThresholdMs: number;
  metricsPath: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",
  appVersion: process.env.APP_VERSION || "1.0.0",
  buildNumber: process.env.BUILD_NUMBER || "1",
  supabaseUrl: process.env.SUPABASE_URL || "http://localhost:54321",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  slowRequestThresholdMs: parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || "500", 10),
  metricsPath: process.env.PROMETHEUS_METRICS_PATH || "/metrics",
};
