/**
 * Micro Task Queue for Decoupled Asynchronous Background Processing
 * Offloads expensive workloads (bulk WhatsApp messages, PDF rendering, email notifications)
 * from main HTTP request loops to ensure instant UI responsiveness (<50ms).
 */

export type JobType =
  "SEND_WHATSAPP" | "SEND_EMAIL" | "GENERATE_FINANCE_PDF" | "SYNC_LOYALTY" | "SEO_AI_GENERATE";

export type QueueJob<T = Record<string, unknown>> = {
  id: string;
  type: JobType;
  payload: T;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
};

class MicroTaskQueue {
  private queue: QueueJob[] = [];
  private processing = false;
  private handlers = new Map<JobType, (payload: any) => Promise<void>>();

  registerHandler(type: JobType, handler: (payload: any) => Promise<void>): void {
    this.handlers.set(type, handler);
  }

  enqueue<T = Record<string, unknown>>(type: JobType, payload: T, maxAttempts = 3): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: QueueJob<T> = {
      id,
      type,
      payload,
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
    };

    this.queue.push(job as QueueJob);
    this.processNext();
    return id;
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const job = this.queue.shift();
    if (!job) {
      this.processing = false;
      return;
    }

    const handler = this.handlers.get(job.type);
    if (!handler) {
      console.warn(`[Queue] No registered handler for job type "${job.type}"`);
      this.processing = false;
      this.processNext();
      return;
    }

    try {
      job.attempts += 1;
      await handler(job.payload);
    } catch (err) {
      console.error(
        `[Queue] Error processing job ${job.id} (attempt ${job.attempts}/${job.maxAttempts}):`,
        err,
      );
      if (job.attempts < job.maxAttempts) {
        // Exponential backoff re-queue
        setTimeout(
          () => {
            this.queue.push(job);
            this.processNext();
          },
          Math.pow(2, job.attempts) * 1000,
        );
      }
    } finally {
      this.processing = false;
      this.processNext();
    }
  }

  size(): number {
    return this.queue.length;
  }
}

export const taskQueue = new MicroTaskQueue();

// Helper to mask PII in server logs
function maskPhone(phone?: string) {
  if (!phone) return "[NONE]";
  return phone.length <= 4 ? "[REDACTED]" : phone.slice(0, 3) + "****" + phone.slice(-4);
}
function maskEmail(email?: string) {
  if (!email || !email.includes("@")) return "[REDACTED]";
  const [u, d] = email.split("@");
  return u.slice(0, 2) + "***@" + d;
}

// Register default async background handlers
taskQueue.registerHandler("SEND_WHATSAPP", async (payload) => {
  console.log("[Worker] Async WhatsApp dispatch:", maskPhone(payload.phone));
});

taskQueue.registerHandler("SEND_EMAIL", async (payload) => {
  console.log("[Worker] Async Email dispatch:", maskEmail(payload.to));
});

taskQueue.registerHandler("SYNC_LOYALTY", async (payload) => {
  console.log("[Worker] Async Loyalty sync:", payload.patientId);
});
