// Server-only BullMQ Queues Definition
import { Queue, QueueOptions } from "bullmq";
import { getRedisInstance } from "../redis";

// Common Redis connection options for BullMQ
function getQueueRedisConnection() {
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = parseInt(process.env.REDIS_PORT || "6379", 10);
  const password = process.env.REDIS_PASSWORD;
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    // Parse REDIS_URL into host, port, password for BullMQ compatibility
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

  return {
    host,
    port,
    password,
    maxRetriesPerRequest: null,
  };
}

const defaultQueueOptions: QueueOptions = {
  connection: getQueueRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // 2s, 4s, 8s retries
    },
    removeOnComplete: { age: 86400, count: 1000 }, // Keep max 1000 completed jobs for 24h
    removeOnFail: { age: 604800, count: 5000 },     // Keep max 5000 failed jobs for 7 days
  },
};

// Queue instances
export let whatsappQueue: Queue | null = null;
export let emailQueue: Queue | null = null;
export let cronQueue: Queue | null = null;
export let webhookQueue: Queue | null = null;

try {
  whatsappQueue = new Queue("whatsapp-messages", defaultQueueOptions);
  emailQueue = new Queue("email-notifications", defaultQueueOptions);
  cronQueue = new Queue("cron-jobs", defaultQueueOptions);
  webhookQueue = new Queue("webhooks", defaultQueueOptions);
} catch (err) {
  console.warn("[BullMQ] Failed to instantiate queues:", (err as Error).message);
}

export type WhatsAppJobData = {
  sessionId: string;
  phone: string;
  message: string;
  appointmentId?: string;
  templateKey?: string;
};

export type EmailJobData = {
  to: string;
  subject: string;
  html: string;
  clinicId?: string;
};

export type CronJobData = {
  jobType: "reminders" | "followups" | "reviews" | "birthdays" | "vaccinations";
  cronKey?: string;
};

export async function enqueueWhatsAppMessage(data: WhatsAppJobData, opts?: { delay?: number; priority?: number }) {
  if (!whatsappQueue) return null;
  try {
    return await whatsappQueue.add("send-whatsapp", data, {
      delay: opts?.delay,
      priority: opts?.priority,
    });
  } catch (err) {
    console.error("[BullMQ] Failed to enqueue WhatsApp message:", err);
    return null;
  }
}

export async function enqueueEmailJob(data: EmailJobData, opts?: { delay?: number }) {
  if (!emailQueue) return null;
  try {
    return await emailQueue.add("send-email", data, { delay: opts?.delay });
  } catch (err) {
    console.error("[BullMQ] Failed to enqueue email job:", err);
    return null;
  }
}

export async function enqueueCronBatch(data: CronJobData) {
  if (!cronQueue) return null;
  try {
    return await cronQueue.add("process-cron-batch", data);
  } catch (err) {
    console.error("[BullMQ] Failed to enqueue cron batch:", err);
    return null;
  }
}
