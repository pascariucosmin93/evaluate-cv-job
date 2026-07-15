import { z } from "zod";
import { MatchResponse } from "../types.js";

const ollamaResponseSchema = z.object({
  response: z.string().min(2)
});

const aiMatchSchema: z.ZodType<MatchResponse> = z.object({
  matchScore: z.number().min(0).max(100),
  verdict: z.enum(["strong-fit", "partial-fit", "weak-fit"]),
  summary: z.string().min(20),
  matchedKeywords: z.array(z.string()).max(20),
  missingKeywords: z.array(z.string()).max(20),
  strengths: z.array(z.string()).min(1).max(8),
  risks: z.array(z.string()).min(1).max(8),
  recommendations: z.array(z.string()).min(1).max(8),
  breakdown: z.object({
    skills: z.number().min(0).max(100),
    experience: z.number().min(0).max(100),
    seniority: z.number().min(0).max(100),
    domain: z.number().min(0).max(100),
    communication: z.number().min(0).max(100)
  })
});

function buildPrompt(jobDescription: string, cv: string) {
  return [
    "You evaluate how well a CV matches a job description.",
    "Return only valid JSON.",
    "Do not include markdown fences or explanations.",
    "Use this exact schema:",
    '{"matchScore":0,"verdict":"strong-fit|partial-fit|weak-fit","summary":"string","matchedKeywords":["string"],"missingKeywords":["string"],"strengths":["string"],"risks":["string"],"recommendations":["string"],"breakdown":{"skills":0,"experience":0,"seniority":0,"domain":0,"communication":0}}',
    "Rules:",
    "- matchScore and every breakdown score must be integers from 0 to 100.",
    "- verdict must align with matchScore: >=75 strong-fit, >=50 partial-fit, otherwise weak-fit.",
    "- Keep strengths, risks, recommendations concise and specific.",
    "- matchedKeywords and missingKeywords should be short technology or skill terms.",
    "",
    "JOB DESCRIPTION:",
    jobDescription,
    "",
    "CV:",
    cv
  ].join("\n");
}

export async function evaluateMatchWithOllama(jobDescription: string, cv: string): Promise<MatchResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://ollama:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 45000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt: buildPrompt(jobDescription, cv),
        stream: false,
        format: "json"
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}.`);
    }

    const responsePayload = ollamaResponseSchema.parse(await response.json());
    const parsedMatch = aiMatchSchema.parse(JSON.parse(responsePayload.response));

    return {
      ...parsedMatch,
      matchScore: Math.round(parsedMatch.matchScore),
      breakdown: {
        skills: Math.round(parsedMatch.breakdown.skills),
        experience: Math.round(parsedMatch.breakdown.experience),
        seniority: Math.round(parsedMatch.breakdown.seniority),
        domain: Math.round(parsedMatch.breakdown.domain),
        communication: Math.round(parsedMatch.breakdown.communication)
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}
