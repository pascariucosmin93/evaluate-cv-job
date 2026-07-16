import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { JobPayload, JobRecord, JobType } from "../types.js";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const queueName = process.env.REDIS_QUEUE_NAME || "cv-evaluation-jobs";
const jobTtlSeconds = Number(process.env.REDIS_JOB_TTL_SECONDS || 86400);

let commandClient: RedisClientType | null = null;
let blockingClient: RedisClientType | null = null;

function jobKey(jobId: string) {
  return `cv-job:${jobId}`;
}

async function connectClient(client: RedisClientType) {
  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export async function getRedisClient() {
  if (!commandClient) {
    commandClient = createClient({ url: redisUrl });
  }

  return connectClient(commandClient);
}

export async function getBlockingRedisClient() {
  if (!blockingClient) {
    blockingClient = createClient({ url: redisUrl });
  }

  return connectClient(blockingClient);
}

export async function enqueueJob(type: JobType, payload: JobPayload) {
  const client = await getRedisClient();
  const now = new Date().toISOString();
  const job: JobRecord = {
    id: randomUUID(),
    type,
    status: "pending",
    payload,
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now
  };

  await client.set(jobKey(job.id), JSON.stringify(job), { EX: jobTtlSeconds });
  await client.rPush(queueName, job.id);

  return job;
}

export async function getJob(jobId: string) {
  const client = await getRedisClient();
  const rawJob = await client.get(jobKey(jobId));

  if (!rawJob) {
    return null;
  }

  return JSON.parse(rawJob) as JobRecord;
}

export async function updateJob(jobId: string, mutate: (job: JobRecord) => JobRecord) {
  const client = await getRedisClient();
  const currentJob = await getJob(jobId);

  if (!currentJob) {
    return null;
  }

  const nextJob = {
    ...mutate(currentJob),
    updatedAt: new Date().toISOString()
  };

  await client.set(jobKey(jobId), JSON.stringify(nextJob), { EX: jobTtlSeconds });
  return nextJob;
}

export async function popQueuedJobId() {
  const client = await getBlockingRedisClient();
  const result = await client.brPop(queueName, 0);
  return result?.element ?? null;
}

export async function closeRedisConnections() {
  if (blockingClient?.isOpen) {
    await blockingClient.quit();
  }

  if (commandClient?.isOpen) {
    await commandClient.quit();
  }
}
