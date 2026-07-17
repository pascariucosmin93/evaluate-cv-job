import { z } from "zod";
import { MatchResponse, TailoredCvResponse } from "../types.js";
import { evaluateMatch } from "./evaluate.js";

const ollamaResponseSchema = z.object({
  response: z.string().min(2)
});

const stringListField = z.union([z.array(z.string()), z.string()]).optional();

const partialAiMatchSchema = z.object({
  matchScore: z.number().min(0).max(100),
  verdict: z.enum(["strong-fit", "partial-fit", "weak-fit"]).optional(),
  summary: z.string().min(20),
  matchedKeywords: stringListField,
  missingKeywords: stringListField,
  strengths: stringListField,
  risks: stringListField,
  recommendations: stringListField,
  breakdown: z.object({
    skills: z.number().min(0).max(100).optional(),
    experience: z.number().min(0).max(100).optional(),
    seniority: z.number().min(0).max(100).optional(),
    domain: z.number().min(0).max(100).optional(),
    communication: z.number().min(0).max(100).optional()
  }).optional()
});

const aiTailoredCvSchema = z.object({
  tailoredCv: z.string().min(100),
  changesSummary: z.union([z.array(z.string()), z.string()]).optional(),
  notes: z.union([z.array(z.string()), z.string()]).optional(),
  addedSkills: z.union([z.array(z.string()), z.string()]).optional(),
  rejectedSkills: z.union([z.array(z.string()), z.string()]).optional()
});

function toStringArray(values: string[] | string | undefined): string[] {
  if (Array.isArray(values)) {
    return values;
  }

  if (typeof values === "string") {
    return values
      .split(/\n|;|,\s*/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

function ensureItems(values: string[] | string | undefined, fallback: string): string[] {
  const sanitized = toStringArray(values)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => !/^(none|n\/a|null|nu exista)$/i.test(value));

  if (sanitized.length === 0) {
    return [fallback];
  }

  return sanitized.slice(0, 8);
}

function optionalItems(values: string[] | string | undefined): string[] {
  return toStringArray(values)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => !/^(none|n\/a|null|nu exista)$/i.test(value))
    .slice(0, 12);
}

function normalizeAiMatch(
  raw: z.infer<typeof partialAiMatchSchema>,
  deterministicResult: MatchResponse
): MatchResponse {
  const hardMismatch =
    deterministicResult.matchScore <= 20 && deterministicResult.matchedKeywords.length === 0;

  if (hardMismatch) {
    return deterministicResult;
  }

  const matchScore = Math.round(raw.matchScore);
  const breakdown = raw.breakdown
    ? {
        skills: Math.round(raw.breakdown.skills ?? deterministicResult.breakdown.skills),
        experience: Math.round(raw.breakdown.experience ?? deterministicResult.breakdown.experience),
        seniority: Math.round(raw.breakdown.seniority ?? deterministicResult.breakdown.seniority),
        domain: Math.round(raw.breakdown.domain ?? deterministicResult.breakdown.domain),
        communication: Math.round(
          raw.breakdown.communication ?? deterministicResult.breakdown.communication
        )
      }
    : deterministicResult.breakdown;

  return {
    matchScore,
    verdict: matchScore >= 75 ? "strong-fit" : matchScore >= 50 ? "partial-fit" : "weak-fit",
    summary: raw.summary,
    detectedCvDomain: deterministicResult.detectedCvDomain,
    detectedJobDomain: deterministicResult.detectedJobDomain,
    domainMismatch: deterministicResult.domainMismatch,
    matchedKeywords: optionalItems(raw.matchedKeywords),
    missingKeywords: optionalItems(raw.missingKeywords),
    strengths: ensureItems(
      raw.strengths,
      deterministicResult.strengths[0] ?? "Analiza nu a produs puncte forte suplimentare."
    ),
    risks: ensureItems(
      raw.risks,
      deterministicResult.risks[0] ?? "Analiza nu a produs riscuri suplimentare."
    ),
    recommendations: ensureItems(
      raw.recommendations,
      deterministicResult.recommendations[0] ?? "Actualizeaza CV-ul astfel incat cerintele cheie sa fie vizibile explicit."
    ),
    breakdown
  };
}

function compressCvForTailoring(cv: string, relevantKeywords: string[]) {
  const normalizedKeywords = relevantKeywords.map((keyword) => keyword.toLowerCase());
  const rawSegments = cv
    .replace(/\r/g, "")
    .split(/\n{2,}|\s{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const prioritizedSegments = rawSegments.filter((segment) => {
    const normalizedSegment = segment.toLowerCase();
    return normalizedKeywords.some((keyword) => normalizedSegment.includes(keyword));
  });

  const orderedSegments = [
    ...prioritizedSegments,
    ...rawSegments.filter((segment) => !prioritizedSegments.includes(segment))
  ];

  return orderedSegments.join("\n").slice(0, 3200);
}

function buildPrompt(jobDescription: string, cv: string) {
  const deterministicResult = evaluateMatch(jobDescription, cv);

  return [
    "Evaluezi cat de bine se potriveste un CV cu un job description.",
    "Raspunzi doar in limba romana.",
    "Esti strict, dar nu ignori dovezile explicite din CV.",
    "Mai intai identifica domeniul principal al jobului si al CV-ului, apoi compara cerintele si responsabilitatile folosind acel context.",
    "Returneaza doar JSON valid.",
    "Nu include markdown fences sau explicatii in afara JSON-ului.",
    "Foloseste exact aceasta schema:",
    '{"matchScore":0,"verdict":"strong-fit|partial-fit|weak-fit","summary":"string","matchedKeywords":["string"],"missingKeywords":["string"],"strengths":["string"],"risks":["string"],"recommendations":["string"],"breakdown":{"skills":0,"experience":0,"seniority":0,"domain":0,"communication":0}}',
    "Reguli:",
    "- matchScore si toate scorurile din breakdown trebuie sa fie intregi intre 0 si 100.",
    "- verdict trebuie sa fie aliniat cu matchScore: >=75 strong-fit, >=50 partial-fit, altfel weak-fit.",
    "- Daca JD si CV sunt din profesii clar diferite, scorul trebuie de regula intre 0 si 20.",
    "- Nu limita analiza la exemplele de tehnologii din prompt; extrage si compara cerintele specifice acestui JD.",
    "- Nu folosi valori placeholder precum 'none', 'None', 'N/A' sau liste goale mascate textual.",
    "- strengths, risks si recommendations trebuie sa fie concrete si complete.",
    "- matchedKeywords si missingKeywords trebuie sa fie termeni scurti de skill, responsabilitate sau unealta relevanta pentru profesia analizata.",
    "- Daca exista suprapuneri, mentioneaza-le explicit in matchedKeywords si in summary.",
    "- matchScore si breakdown trebuie sa reflecte comparatia ta efectiva dintre acest JD si acest CV.",
    "",
    `Scor determinist calculat deja: ${deterministicResult.matchScore}%`,
    `Breakdown determinist: skills=${deterministicResult.breakdown.skills}, experience=${deterministicResult.breakdown.experience}, seniority=${deterministicResult.breakdown.seniority}, domain=${deterministicResult.breakdown.domain}, communication=${deterministicResult.breakdown.communication}`,
    `Domeniu detectat pentru JD: ${deterministicResult.detectedJobDomain.label} (${deterministicResult.detectedJobDomain.confidence}%)`,
    `Domeniu detectat pentru CV: ${deterministicResult.detectedCvDomain.label} (${deterministicResult.detectedCvDomain.confidence}%)`,
    `Suprapuneri orientative detectate: ${deterministicResult.matchedKeywords.join(", ") || "niciuna"}`,
    `Cerinte orientative din JD care nu apar in CV: ${deterministicResult.missingKeywords.join(", ") || "niciuna"}`,
    "",
    "JOB DESCRIPTION:",
    jobDescription,
    "",
    "CV:",
    cv
  ].join("\n");
}

function buildTailorCvPrompt(jobDescription: string, cv: string) {
  const deterministicResult = evaluateMatch(jobDescription, cv);
  const missingKeywords = deterministicResult.missingKeywords;
  const promptCv = compressCvForTailoring(
    cv,
    [...deterministicResult.matchedKeywords, ...missingKeywords]
  );

  return [
    "Adaptezi un CV pentru un job description.",
    "Raspunzi doar in limba romana.",
    "Returneaza doar JSON valid.",
    "Nu include explicatii in afara JSON-ului.",
    "Fa modificari minime.",
    "Adauga skill-urile lipsa doar daca sunt sustinute de CV.",
    "Nu inventa experienta, proiecte, certificari, ani, tool-uri sau responsabilitati care nu apar in CV.",
    "Pastreaza structura generala si informatia factuala.",
    "Daca o cerinta nu este sustinuta, pune-o in rejectedSkills.",
    "Schema exacta:",
    '{"tailoredCv":"string","changesSummary":["string"],"notes":["string"],"addedSkills":["string"],"rejectedSkills":["string"]}',
    "",
    `Match curent: ${deterministicResult.matchScore}%`,
    `Cerinte deja sustinute: ${deterministicResult.matchedKeywords.join(", ") || "niciuna"}`,
    `Cerinte lipsa: ${missingKeywords.join(", ") || "niciuna"}`,
    "",
    "JOB DESCRIPTION:",
    jobDescription.slice(0, 1800),
    "",
    "CV ORIGINAL:",
    promptCv
  ].join("\n");
}

export async function evaluateMatchWithOllama(jobDescription: string, cv: string): Promise<MatchResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://ollama:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 45000);
  const deterministicResult = evaluateMatch(jobDescription, cv);

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

    return normalizeAiMatch(parsedMatch, deterministicResult);
  } catch (error) {
    if (error instanceof Error) {
      if (process.env.ALLOW_DETERMINISTIC_FALLBACK !== "false") {
        return deterministicResult;
      }

      throw new Error(`AI evaluation failed: ${error.message}`);
    }

    if (process.env.ALLOW_DETERMINISTIC_FALLBACK !== "false") {
      return deterministicResult;
    }

    throw new Error("AI evaluation failed.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function tailorCvWithOllama(jobDescription: string, cv: string): Promise<TailoredCvResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://ollama:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 45000);
  const deterministicResult = evaluateMatch(jobDescription, cv);
  const rejectedKeywords = deterministicResult.missingKeywords.length > 0
    ? deterministicResult.missingKeywords
    : deterministicResult.detectedJobDomain.evidence;

  if (
    deterministicResult.matchScore <= 20 &&
    deterministicResult.domainMismatch
  ) {
    return {
      tailoredCv: cv,
      changesSummary: [
        "Generarea unui CV adaptat a fost oprita pentru ca JD-ul nu este compatibil cu profilul actual."
      ],
      notes: [
        deterministicResult.summary,
        `Nu este corect sa rescriem un CV din ${deterministicResult.detectedCvDomain.label} ca sa para relevant pentru un rol din ${deterministicResult.detectedJobDomain.label}.`
      ],
      addedSkills: [],
      rejectedSkills: rejectedKeywords,
      blocked: true,
      blockReason: "JD-ul este din alt domeniu, deci aplicatia nu genereaza un CV adaptat artificial."
    };
  }

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
        prompt: buildTailorCvPrompt(jobDescription, cv),
        stream: false,
        format: "json",
        options: {
          num_predict: 900,
          temperature: 0.2
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}.`);
    }

    const responsePayload = ollamaResponseSchema.parse(await response.json());
    const parsed = aiTailoredCvSchema.parse(JSON.parse(responsePayload.response));

    return {
      tailoredCv: parsed.tailoredCv.trim(),
      changesSummary: ensureItems(
        parsed.changesSummary,
        "AI-ul nu a listat modificarile; compara varianta originala cu cea propusa."
      ),
      notes: ensureItems(
        parsed.notes,
        "Verifica manual ca reformularile sa ramana complet fidele experientei tale reale."
      ),
      addedSkills: ensureItems(
        parsed.addedSkills,
        "AI-ul nu a confirmat skill-uri adaugate explicit."
      ),
      rejectedSkills: ensureItems(
        parsed.rejectedSkills,
        "AI-ul nu a marcat skill-uri respinse explicit."
      ),
      blocked: false,
      blockReason: null
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`AI CV tailoring failed: ${error.message}`);
    }

    throw new Error("AI CV tailoring failed.");
  } finally {
    clearTimeout(timeout);
  }
}
