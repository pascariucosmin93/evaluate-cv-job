import { z } from "zod";
import { MatchResponse } from "../types.js";

const KEYWORD_GROUPS: Record<string, string[]> = {
  aws: ["aws", "ec2", "ecs", "eks", "cloudformation"],
  azure: ["azure", "aks", "azure devops", "azure monitor", "azure key vault"],
  terraform: ["terraform"],
  kubernetes: ["kubernetes", "k8s", "eks", "aks"],
  docker: ["docker", "containers"],
  ansible: ["ansible"],
  gitlab_ci: ["gitlab ci", "gitlab"],
  github_actions: ["github actions"],
  jenkins: ["jenkins"],
  grafana: ["grafana"],
  prometheus: ["prometheus"],
  loki: ["loki"],
  vault: ["vault", "hashicorp vault"],
  linux: ["linux", "ubuntu", "debian", "centos"],
  argocd: ["argo cd", "argocd"],
  helm: ["helm"],
  bash: ["bash"],
  powershell: ["powershell"],
  networking: ["dns", "nginx", "haproxy", "keepalived", "networking"],
  observability: ["observability", "monitoring", "cloudwatch"]
};

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

function verdictFromScore(score: number): MatchResponse["verdict"] {
  if (score >= 75) {
    return "strong-fit";
  }

  if (score >= 50) {
    return "partial-fit";
  }

  return "weak-fit";
}

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
    matchedKeywords: ensureItems(raw.matchedKeywords, "Nu exista suprapuneri relevante confirmate clar de model.").slice(0, 20),
    missingKeywords: ensureItems(raw.missingKeywords, "Modelul nu a enumerat lipsuri explicite.").slice(0, 20),
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

function extractKeywordMatches(text: string): string[] {
  const normalized = text.toLowerCase();

  return Object.entries(KEYWORD_GROUPS)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(alias)))
    .map(([keyword]) => keyword);
}

function buildPrompt(jobDescription: string, cv: string) {
  const jdKeywords = extractKeywordMatches(jobDescription);
  const cvKeywords = extractKeywordMatches(cv);
  const sharedKeywords = jdKeywords.filter((keyword) => cvKeywords.includes(keyword));
  const jdOnlyKeywords = jdKeywords.filter((keyword) => !cvKeywords.includes(keyword));

  return [
    "Evaluezi cat de bine se potriveste un CV cu un job description.",
    "Raspunzi doar in limba romana.",
    "Esti strict, dar nu ignori dovezile explicite din CV.",
    "Daca exista overlap tehnic clar intre JD si CV, nu ai voie sa dai 0% sau 5%.",
    "Returneaza doar JSON valid.",
    "Nu include markdown fences sau explicatii in afara JSON-ului.",
    "Foloseste exact aceasta schema:",
    '{"matchScore":0,"verdict":"strong-fit|partial-fit|weak-fit","summary":"string","matchedKeywords":["string"],"missingKeywords":["string"],"strengths":["string"],"risks":["string"],"recommendations":["string"],"breakdown":{"skills":0,"experience":0,"seniority":0,"domain":0,"communication":0}}',
    "Reguli:",
    "- matchScore si toate scorurile din breakdown trebuie sa fie intregi intre 0 si 100.",
    "- verdict trebuie sa fie aliniat cu matchScore: >=75 strong-fit, >=50 partial-fit, altfel weak-fit.",
    "- Daca JD si CV sunt din profesii clar diferite, scorul trebuie de regula intre 0 si 20.",
    "- Daca exista 5 sau mai multe suprapuneri tehnice clare intre JD si CV, scorul nu poate fi sub 35.",
    "- Daca exista 2-4 suprapuneri tehnice clare, scorul nu poate fi 0 si de regula nu trebuie sa fie sub 20.",
    "- Nu ignora experienta explicita din CV cu AWS, Azure, Terraform, Kubernetes, Docker, Ansible, GitLab CI, Jenkins, Prometheus, Grafana, Argo CD, Helm, Linux.",
    "- Nu folosi valori placeholder precum 'none', 'None', 'N/A' sau liste goale mascate textual.",
    "- strengths, risks si recommendations trebuie sa fie concrete si complete.",
    "- matchedKeywords si missingKeywords trebuie sa fie termeni scurti de skill sau tehnologie.",
    "- Daca exista suprapuneri, mentioneaza-le explicit in matchedKeywords si in summary.",
    "",
    `Semnale tehnice extrase din JD: ${jdKeywords.join(", ") || "niciunul"}`,
    `Semnale tehnice extrase din CV: ${cvKeywords.join(", ") || "niciunul"}`,
    `Suprapuneri tehnice detectate: ${sharedKeywords.join(", ") || "niciuna"}`,
    `Cerinte tehnice din JD care nu apar in CV: ${jdOnlyKeywords.join(", ") || "niciuna"}`,
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
