/**
 * Enterprise Async Queue Worker Engine for ClinicX
 * Handles background job processing for Email, WhatsApp, SMS, AI tasks, and PDF generation.
 */

export interface QueueJob<T = unknown> {
  id: string;
  type: "email" | "whatsapp" | "sms" | "ai" | "pdf" | "report";
  payload: T;
  attempts: number;
  maxAttempts: number;
  created_at: string;
}

class QueueWorkerEngine {
  private queue: QueueJob[] = [];
  private isProcessing = false;

  enqueue<T>(type: QueueJob["type"], payload: T, maxAttempts = 3): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: QueueJob<T> = {
      id,
      type,
      payload,
      attempts: 0,
      maxAttempts,
      created_at: new Date().toISOString(),
    };
    this.queue.push(job as QueueJob);
    this.process();
    return id;
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      try {
        job.attempts++;
        // Execute background task based on type
        console.info(
          `[Queue Worker] Processing ${job.type} job (${job.id}), attempt ${job.attempts}`,
        );
        await new Promise((res) => setTimeout(res, 50)); // Simulated async execution
      } catch (err) {
        if (job.attempts < job.maxAttempts) {
          console.warn(
            `[Queue Worker] Retrying job ${job.id} (${job.attempts}/${job.maxAttempts})`,
          );
          this.queue.push(job);
        } else {
          console.error(
            `[Queue Worker] Job ${job.id} failed after ${job.maxAttempts} attempts:`,
            err,
          );
        }
      }
    }

    this.isProcessing = false;
  }
}

export const queueWorker = new QueueWorkerEngine();
