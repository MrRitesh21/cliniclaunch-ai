import { DeviceRepository } from "./device.repository";
import { LogService } from "../../logging";
import { Counter, Gauge } from "prom-client";
import { registry } from "../../monitoring/metrics/registry";

// Bounded Prometheus Metrics (Cardinality Safe - No user_id or visitor_id labels!)
export const securityEventsTotal = new Counter({
  name: "security_events_total",
  help: "Total count of security events logged",
  labelNames: ["event_type", "severity"],
  registers: [registry],
});

export const highRiskLoginsTotal = new Counter({
  name: "high_risk_logins_total",
  help: "Total count of high risk login attempts detected",
  registers: [registry],
});

export const devicesTotal = new Gauge({
  name: "devices_total",
  help: "Current registered devices count by status",
  labelNames: ["status"],
  registers: [registry],
});

export const activeUserSessionsTotal = new Gauge({
  name: "active_user_sessions_total",
  help: "Current active user sessions count",
  registers: [registry],
});

export interface SecurityQueueTask {
  type: "LOG_EVENT" | "LOG_AUDIT" | "ROLLUP_METRICS";
  payload: any;
}

class SecurityQueueWorker {
  private queue: SecurityQueueTask[] = [];
  private isProcessing = false;

  constructor() {
    // Process queue items every 500ms
    setInterval(() => this.processNext(), 500);
  }

  public enqueue(task: SecurityQueueTask): void {
    this.queue.push(task);
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const task = this.queue.shift();
    if (!task) {
      this.isProcessing = false;
      return;
    }

    try {
      if (task.type === "LOG_EVENT") {
        const { event } = task.payload;
        await DeviceRepository.logSecurityEvent(event);
        securityEventsTotal.inc({ event_type: event.event_type, severity: event.severity });

        if (event.risk_score >= 71) {
          highRiskLoginsTotal.inc();
        }
      } else if (task.type === "LOG_AUDIT") {
        await DeviceRepository.logAuditAction(task.payload.action);
      } else if (task.type === "ROLLUP_METRICS") {
        // Rollup metrics task
        LogService.debug("[SecurityQueueWorker] Executed background metrics rollup");
      }
    } catch (err: any) {
      LogService.error("[SecurityQueueWorker Error]", err);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const securityQueue = new SecurityQueueWorker();
