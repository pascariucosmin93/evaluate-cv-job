import pino from "pino";
import { evaluateMatchWithOllama, tailorCvWithOllama } from "./lib/ollama.js";
import { closeRedisConnections, getJob, popQueuedJobId, updateJob } from "./lib/queue.js";
import { JobResult } from "./types.js";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

async function processJob(jobId: string) {
  const job = await getJob(jobId);

  if (!job) {
    logger.warn({ jobId }, "Queued job disappeared before processing");
    return;
  }

  await updateJob(jobId, (currentJob) => ({
    ...currentJob,
    status: "processing",
    error: null
  }));

  try {
    let result: JobResult;

    if (job.type === "evaluate") {
      result = {
        jobTitle: job.payload.jobTitle ?? null,
        ...(await evaluateMatchWithOllama(job.payload.jobDescription, job.payload.cv))
      };
    } else {
      result = {
        jobTitle: job.payload.jobTitle ?? null,
        ...(await tailorCvWithOllama(job.payload.jobDescription, job.payload.cv))
      };
    }

    await updateJob(jobId, (currentJob) => ({
      ...currentJob,
      status: "completed",
      result,
      error: null
    }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI job failed unexpectedly.";

    logger.warn({ jobId, error }, "Worker failed to process queued AI job");

    await updateJob(jobId, (currentJob) => ({
      ...currentJob,
      status: "failed",
      result: null,
      error: message
    }));
  }
}

async function startWorker() {
  logger.info("AI worker started");

  while (true) {
    const jobId = await popQueuedJobId();

    if (!jobId) {
      continue;
    }

    await processJob(jobId);
  }
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down AI worker");
  await closeRedisConnections();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void startWorker();
