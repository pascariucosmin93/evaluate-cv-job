import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import pinoHttp from "pino-http";
import { z } from "zod";
import { enqueueJob, getJob } from "./lib/queue.js";

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const port = Number(process.env.PORT || 8080);

const requestSchema = z.object({
  jobDescription: z.string().min(50, "Job description must have at least 50 characters."),
  cv: z.string().min(50, "CV must have at least 50 characters."),
  jobTitle: z.string().max(120).optional()
});

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "evaluate-cv-job-backend-api"
  });
});

app.post("/api/v1/evaluate", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid request payload.",
      issues: parsed.error.issues
    });
    return;
  }

  const job = await enqueueJob("evaluate", parsed.data);

  res.status(202).json({
    jobId: job.id,
    status: job.status
  });
});

app.post("/api/v1/tailor-cv", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid request payload.",
      issues: parsed.error.issues
    });
    return;
  }

  const job = await enqueueJob("tailor-cv", parsed.data);

  res.status(202).json({
    jobId: job.id,
    status: job.status
  });
});

app.get("/api/v1/jobs/:jobId", async (req, res) => {
  const job = await getJob(req.params.jobId);

  if (!job) {
    res.status(404).json({
      message: "Job not found."
    });
    return;
  }

  res.status(200).json({
    id: job.id,
    type: job.type,
    status: job.status,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  });
});

app.use((_req, res) => {
  res.status(404).json({ message: "Not found." });
});

app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Backend listening");
});
