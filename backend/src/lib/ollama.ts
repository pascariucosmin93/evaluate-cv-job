import { z } from "zod";
import { MatchResponse, TailoredCvResponse } from "../types.js";
import { evaluateMatch } from "./evaluate.js";

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
  sentry: ["sentry"],
  prometheus: ["prometheus"],
  loki: ["loki"],
  vault: ["vault", "hashicorp vault"],
  linux: ["linux", "ubuntu", "debian", "centos"],
  argocd: ["argo cd", "argocd"],
  gitops: ["gitops"],
  helm: ["helm"],
  webhooks: ["webhook", "webhooks", "teams notification", "microsoft teams notification"],
  teams: ["microsoft teams", "teams notification", "teams webhook"],
  unity_cloud_build: ["unity cloud build", "cloud build for unity"],
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

const aiTailoredCvSchema = z.object({
  tailoredCv: z.string().min(100),
  changesSummary: z.union([z.array(z.string()), z.string()]).optional(),
  notes: z.union([z.array(z.string()), z.string()]).optional()
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

function normalizeAiMatch(
  raw: z.infer<typeof partialAiMatchSchema>,
  deterministicResult: MatchResponse
): MatchResponse {
  return {
    matchScore: deterministicResult.matchScore,
    verdict: deterministicResult.verdict,
    summary: deterministicResult.summary,
    matchedKeywords: deterministicResult.matchedKeywords,
    missingKeywords: deterministicResult.missingKeywords,
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
    breakdown: deterministicResult.breakdown
  };
}

function extractKeywordMatches(text: string): string[] {
  const normalized = text.toLowerCase();

  return Object.entries(KEYWORD_GROUPS)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(alias)))
    .map(([keyword]) => keyword);
}

function buildPrompt(jobDescription: string, cv: string) {
  const deterministicResult = evaluateMatch(jobDescription, cv);
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
    "- Pastreaza analiza consecventa cu scorul determinist primit mai jos; nu il contrazice textual.",
    "",
    `Scor determinist calculat deja: ${deterministicResult.matchScore}%`,
    `Breakdown determinist: skills=${deterministicResult.breakdown.skills}, experience=${deterministicResult.breakdown.experience}, seniority=${deterministicResult.breakdown.seniority}, domain=${deterministicResult.breakdown.domain}, communication=${deterministicResult.breakdown.communication}`,
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

function buildTailorCvPrompt(jobDescription: string, cv: string) {
  const deterministicResult = evaluateMatch(jobDescription, cv);

  return [
    "Rescrii un CV pentru a se alinia mai bine cu un job description.",
    "Raspunzi doar in limba romana.",
    "Returneaza doar JSON valid.",
    "Nu include markdown fences sau explicatii in afara JSON-ului.",
    "Scopul nu este sa rescrii complet CV-ul, ci sa faci modificari minime si precise.",
    "Nu inventa experienta, proiecte, certificari, ani, tool-uri sau responsabilitati care nu apar in CV.",
    "Pastreaza informatia factuala din CV si structura generala a sectiunilor cat mai aproape de original.",
    "Ai voie sa reformulezi pentru claritate, sa muti accentul pe tehnologiile relevante si sa faci wording-ul mai apropiat de JD.",
    "Daca o cerinta din JD nu este sustinuta de CV, nu o adauga ca experienta reala; eventual o poti mentiona prudent doar daca exista semnale foarte apropiate.",
    "Foloseste exact aceasta schema:",
    '{"tailoredCv":"string","changesSummary":["string"],"notes":["string"]}',
    "Reguli pentru tailoredCv:",
    "- pastreaza numele, contactul, companiile, perioadele si rolurile din CV",
    "- nu sterge sectiuni importante",
    "- schimba doar ce ajuta direct la relevanta pentru JD",
    "- optimizeaza summary-ul, bullet-urile si skills section",
    "- mentine CV-ul plauzibil si onest",
    "",
    `Scor curent estimat: ${deterministicResult.matchScore}%`,
    `Cerinte potrivite deja: ${deterministicResult.matchedKeywords.join(", ") || "niciuna"}`,
    `Cerinte lipsa sau neexplicite: ${deterministicResult.missingKeywords.join(", ") || "niciuna"}`,
    "",
    "JOB DESCRIPTION:",
    jobDescription,
    "",
    "CV ORIGINAL:",
    cv
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
        format: "json"
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
      )
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
