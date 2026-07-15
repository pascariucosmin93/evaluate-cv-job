import { z } from "zod";
import { MatchResponse } from "../types.js";

const ollamaResponseSchema = z.object({
  response: z.string().min(2)
});

const partialAiMatchSchema = z.object({
  matchScore: z.number().min(0).max(100),
  verdict: z.enum(["strong-fit", "partial-fit", "weak-fit"]).optional(),
  summary: z.string().min(20),
  matchedKeywords: z.array(z.string()).max(20).optional(),
  missingKeywords: z.array(z.string()).max(20).optional(),
  strengths: z.array(z.string()).max(8).optional(),
  risks: z.array(z.string()).max(8).optional(),
  recommendations: z.array(z.string()).max(8).optional(),
  breakdown: z.object({
    skills: z.number().min(0).max(100).optional(),
    experience: z.number().min(0).max(100).optional(),
    seniority: z.number().min(0).max(100).optional(),
    domain: z.number().min(0).max(100).optional(),
    communication: z.number().min(0).max(100).optional()
  }).optional()
});

function verdictFromScore(score: number): MatchResponse["verdict"] {
  if (score >= 75) {
    return "strong-fit";
  }

  if (score >= 50) {
    return "partial-fit";
  }

  return "weak-fit";
}

function ensureItems(values: string[] | undefined, fallback: string): string[] {
  if (!values || values.length === 0) {
    return [fallback];
  }

  return values.slice(0, 8);
}

function clampScore(value: number | undefined, fallback: number) {
  return Math.max(0, Math.min(100, Math.round(value ?? fallback)));
}

function normalizeAiMatch(raw: z.infer<typeof partialAiMatchSchema>): MatchResponse {
  const matchScore = clampScore(raw.matchScore, 0);
  const fallbackVerdict = verdictFromScore(matchScore);
  const fallbackBreakdown = {
    skills: matchScore,
    experience: matchScore,
    seniority: matchScore,
    domain: matchScore,
    communication: matchScore
  };

  return {
    matchScore,
    verdict: raw.verdict ?? fallbackVerdict,
    summary: raw.summary,
    matchedKeywords: (raw.matchedKeywords ?? []).slice(0, 20),
    missingKeywords: (raw.missingKeywords ?? []).slice(0, 20),
    strengths: ensureItems(raw.strengths, "Modelul nu a furnizat puncte forte explicite pentru aceasta comparatie."),
    risks: ensureItems(raw.risks, "Modelul nu a furnizat riscuri explicite; verifica manual diferentele dintre JD si CV."),
    recommendations: ensureItems(
      raw.recommendations,
      "Solicita modelului o analiza mai detaliata daca raspunsul actual este prea sumar."
    ),
    breakdown: {
      skills: clampScore(raw.breakdown?.skills, fallbackBreakdown.skills),
      experience: clampScore(raw.breakdown?.experience, fallbackBreakdown.experience),
      seniority: clampScore(raw.breakdown?.seniority, fallbackBreakdown.seniority),
      domain: clampScore(raw.breakdown?.domain, fallbackBreakdown.domain),
      communication: clampScore(raw.breakdown?.communication, fallbackBreakdown.communication)
    }
  };
}

function buildPrompt(jobDescription: string, cv: string) {
  return [
    "You evaluate how well a CV matches a job description.",
    "You are strict. A candidate from a clearly different profession must receive a very low score.",
    "Return only valid JSON.",
    "Do not include markdown fences or explanations.",
    "Use this exact schema:",
    '{"matchScore":0,"verdict":"strong-fit|partial-fit|weak-fit","summary":"string","matchedKeywords":["string"],"missingKeywords":["string"],"strengths":["string"],"risks":["string"],"recommendations":["string"],"breakdown":{"skills":0,"experience":0,"seniority":0,"domain":0,"communication":0}}',
    "Rules:",
    "- matchScore and every breakdown score must be integers from 0 to 100.",
    "- verdict must align with matchScore: >=75 strong-fit, >=50 partial-fit, otherwise weak-fit.",
    "- If the CV and the job description belong to clearly different domains or professions, the score must usually be between 0 and 20.",
    "- Do not reward generic years of experience if they are from a different profession.",
    "- If the job is non-technical and the CV is technical, or the reverse, classify it as a weak-fit unless there is explicit evidence of overlap.",
    "- Use 80-100 only when there is strong, concrete overlap in domain, responsibilities, skills, and seniority.",
    "- Keep strengths, risks, recommendations concise and specific.",
    "- matchedKeywords and missingKeywords should be short technology or skill terms.",
    "- summary, risks, and recommendations must explicitly say when the JD and CV appear to be from different professions.",
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
    const parsedMatch = partialAiMatchSchema.parse(JSON.parse(responsePayload.response));

    return normalizeAiMatch(parsedMatch);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`AI evaluation failed: ${error.message}`);
    }

    throw new Error("AI evaluation failed.");
  } finally {
    clearTimeout(timeout);
  }
}
