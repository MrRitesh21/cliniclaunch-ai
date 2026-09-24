// Server-only BullMQ Background Workers
import { Worker, WorkerOptions, Job } from "bullmq";
import { baileysSend } from "../baileys.server";
import { WhatsAppJobData, EmailJobData, CronJobData } from "./queues";

function getWorkerRedisConnection() {
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = parseInt(process.env.REDIS_PORT || "6379", 10);
  const password = process.env.REDIS_PASSWORD;
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port || "6379", 10),
        password: parsed.password || undefined,
        maxRetriesPerRequest: null,
      };
    } catch {
      // Fallback if URL parsing fails
    }
  }

  return { host, port, password, maxRetriesPerRequest: null };
}

const workerConfig: WorkerOptions = {
  connection: getWorkerRedisConnection(),
  concurrency: 5, // Process up to 5 concurrent jobs per worker instance
};

function maskPhone(phone?: string) {
  if (!phone) return "[NONE]";
  return phone.length <= 4 ? "[REDACTED]" : phone.slice(0, 3) + "****" + phone.slice(-4);
}
function maskEmail(email?: string) {
  if (!email || !email.includes("@")) return "[REDACTED]";
  const [u, d] = email.split("@");
  return u.slice(0, 2) + "***@" + d;
}

// WhatsApp Worker Handler
async function processWhatsAppJob(job: Job<WhatsAppJobData>) {
  const { sessionId, phone, message } = job.data;
  console.log(
    `[BullMQ Worker] Processing WhatsApp message job ${job.id} for phone ${maskPhone(phone)}`,
  );

  const res = await baileysSend(sessionId, phone, message);
  if (!res.ok) {
    throw new Error(`Failed to send WhatsApp message via session ${sessionId}: ${res.error}`);
  }

  return { success: true, phone: maskPhone(phone), sessionId };
}

// Email Worker Handler
async function processEmailJob(job: Job<EmailJobData>) {
  const { to, subject, html } = job.data;
  console.log(`[BullMQ Worker] Processing Email job ${job.id} to ${maskEmail(to)}`);

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn(`[BullMQ Worker] RESEND_API_KEY missing. Skipping email to ${maskEmail(to)}`);
    return { success: false, reason: "RESEND_API_KEY not configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ClinicX <notifications@cliniclaunch.ai>",
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API failed (${response.status}): ${errorText}`);
  }

  return { success: true, to };
}

// Active Workers registry
let whatsappWorker: Worker | null = null;
let emailWorker: Worker | null = null;

export function startWorkers() {
  try {
    if (!whatsappWorker) {
      whatsappWorker = new Worker<WhatsAppJobData>(
        "whatsapp-messages",
        processWhatsAppJob,
        workerConfig,
      );
      whatsappWorker.on("completed", (job) =>
        console.log(`[Worker: WhatsApp] Job ${job.id} completed.`),
      );
      whatsappWorker.on("failed", (job, err) =>
        console.error(`[Worker: WhatsApp] Job ${job?.id} failed:`, err.message),
      );
    }

    if (!emailWorker) {
      emailWorker = new Worker<EmailJobData>("email-notifications", processEmailJob, workerConfig);
      emailWorker.on("completed", (job) => console.log(`[Worker: Email] Job ${job.id} completed.`));
      emailWorker.on("failed", (job, err) =>
        console.error(`[Worker: Email] Job ${job?.id} failed:`, err.message),
      );
    }

    console.log("[BullMQ] All background workers started.");
  } catch (err) {
    console.error("[BullMQ] Error starting workers:", (err as Error).message);
  }
}

export async function stopWorkers() {
  if (whatsappWorker) {
    await whatsappWorker.close();
    whatsappWorker = null;
  }
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
  }
  console.log("[BullMQ] All workers stopped.");
}
