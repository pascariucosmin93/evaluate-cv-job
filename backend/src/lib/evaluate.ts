import { MatchResponse, ScoreBreakdown } from "../types.js";

type KeywordDefinition = {
  aliases: string[];
  category: "core" | "supporting";
};

const KEYWORD_GROUPS: Record<string, KeywordDefinition> = {
  azure: { aliases: ["azure", "azure ad", "azure active directory", "aks", "azure devops", "azure monitor", "azure key vault"], category: "core" },
  terraform: { aliases: ["terraform", "infrastructure as code", "iac"], category: "core" },
  argocd: { aliases: ["argo cd", "argocd"], category: "core" },
  gitops: { aliases: ["gitops"], category: "core" },
  github_actions: { aliases: ["github actions"], category: "core" },
  docker: { aliases: ["docker", "container", "containerized", "containers"], category: "core" },
  kubernetes: { aliases: ["kubernetes", "k8s", "helm", "aks", "eks"], category: "core" },
  grafana: { aliases: ["grafana"], category: "core" },
  sentry: { aliases: ["sentry"], category: "supporting" },
  webhooks: { aliases: ["webhook", "webhooks", "teams notification", "microsoft teams notification"], category: "supporting" },
  teams: { aliases: ["microsoft teams", "teams notification", "teams webhook"], category: "supporting" },
  unity_cloud_build: { aliases: ["unity cloud build", "cloud build for unity"], category: "supporting" },
  ci_cd: { aliases: ["ci/cd", "ci cd", "pipeline", "pipelines", "gitlab ci", "jenkins"], category: "core" },
  monitoring: { aliases: ["monitoring", "observability", "prometheus", "loki", "cloudwatch"], category: "supporting" },
  troubleshooting: { aliases: ["troubleshoot", "troubleshooting", "root-cause", "incident", "support"], category: "supporting" },
  communication: { aliases: ["communication", "collaboration", "cross-functional", "stakeholder", "english", "engleza"], category: "supporting" },
  linux: { aliases: ["linux", "ubuntu", "debian", "centos"], category: "supporting" },
  networking: { aliases: ["dns", "networking", "network", "haproxy", "keepalived", "nginx"], category: "supporting" },
  aws: { aliases: ["aws", "ec2", "ecs", "eks", "cloudformation"], category: "supporting" }
};

const SENIORITY_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "intern", pattern: /\bintern(ship)?\b/ },
  { label: "junior", pattern: /\bjunior\b/ },
  { label: "mid", pattern: /\b(mid|middle|mid-level)\b/ },
  { label: "senior", pattern: /\bsenior\b/ },
  { label: "lead", pattern: /\b(lead|team lead|tech lead)\b/ },
  { label: "staff", pattern: /\bstaff\b/ },
  { label: "principal", pattern: /\bprincipal\b/ },
  { label: "manager", pattern: /\bmanager\b/ }
];

const DOMAIN_PATTERNS = [
  "devops",
  "platform",
  "cloud",
  "infrastructure",
  "sre",
  "site reliability",
  "kubernetes",
  "ci/cd",
  "ci cd",
  "gitops",
  "observability",
  "monitoring",
  "deployment"
];

const GENERIC_IT_PATTERNS = [
  "software",
  "engineer",
  "developer",
  "backend",
  "frontend",
  "fullstack",
  "full-stack",
  "cloud",
  "infra",
  "infrastructure",
  "system administrator",
  "sysadmin",
  "administrator",
  "security",
  "database",
  "network engineer",
  "site reliability"
];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/\r/g, "\n")
    .replace(/[^\p{L}\p{N}\s+#./-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function extractKeywordMatches(text: string): string[] {
  return unique(
    Object.entries(KEYWORD_GROUPS)
      .filter(([, definition]) => definition.aliases.some((alias) => text.includes(alias)))
      .map(([keyword]) => keyword)
  );
}

function extractYears(text: string): number[] {
  const matches = [...text.matchAll(/(\d{1,2})\+?\s*(years|year|yrs|ani)/g)];
  return matches.map((match) => Number(match[1])).filter(Number.isFinite);
}

function detectSeniority(text: string): string | null {
  return SENIORITY_PATTERNS.find(({ pattern }) => pattern.test(text))?.label ?? null;
}

function looksTechnical(text: string): boolean {
  return (
    extractKeywordMatches(text).length > 0 ||
    DOMAIN_PATTERNS.some((signal) => text.includes(signal)) ||
    GENERIC_IT_PATTERNS.some((signal) => text.includes(signal))
  );
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreSkills(jobKeywords: string[], cvKeywords: string[]) {
  if (jobKeywords.length === 0) {
    return {
      score: cvKeywords.length > 0 ? 55 : 40,
      matched: [],
      missing: []
    };
  }

  const matched = jobKeywords.filter((keyword) => cvKeywords.includes(keyword));
  const missing = jobKeywords.filter((keyword) => !cvKeywords.includes(keyword));
  const coreKeywords = jobKeywords.filter((keyword) => KEYWORD_GROUPS[keyword]?.category === "core");
  const supportingKeywords = jobKeywords.filter((keyword) => KEYWORD_GROUPS[keyword]?.category === "supporting");
  const matchedCore = coreKeywords.filter((keyword) => cvKeywords.includes(keyword));
  const matchedSupporting = supportingKeywords.filter((keyword) => cvKeywords.includes(keyword));
  const coreRatio = coreKeywords.length > 0 ? matchedCore.length / coreKeywords.length : 0.6;
  const supportingRatio =
    supportingKeywords.length > 0 ? matchedSupporting.length / supportingKeywords.length : 0.6;
  const blendedScore = coreRatio * 78 + supportingRatio * 22;

  return {
    score: clamp(blendedScore),
    matched,
    missing
  };
}

function scoreExperience(jobText: string, cvText: string): number {
  const jobYears = extractYears(jobText);
  const cvYears = extractYears(cvText);
  const jobTarget = Math.max(...jobYears, 0);
  const cvLevel = Math.max(...cvYears, average(cvYears));

  if (jobTarget > 0 && cvLevel > 0) {
    return clamp((cvLevel / jobTarget) * 100);
  }

  if (cvLevel >= 5) {
    return 88;
  }

  if (cvLevel >= 3) {
    return 76;
  }

  if (cvLevel > 0) {
    return 62;
  }

  return 52;
}

function scoreSeniority(jobText: string, cvText: string): number {
  const jobSeniority = detectSeniority(jobText);
  const cvSeniority = detectSeniority(cvText);

  if (!jobSeniority && cvSeniority) {
    return cvSeniority === "mid" || cvSeniority === "senior" ? 78 : 68;
  }

  if (!jobSeniority && !cvSeniority) {
    return 65;
  }

  if (!cvSeniority) {
    return 55;
  }

  if (jobSeniority === cvSeniority) {
    return 100;
  }

  const order = ["intern", "junior", "mid", "senior", "lead", "staff", "principal", "manager"];
  const normalizedJobSeniority = jobSeniority ?? "mid";
  const normalizedCvSeniority = cvSeniority ?? "mid";
  const distance = Math.abs(
    order.indexOf(normalizedJobSeniority) - order.indexOf(normalizedCvSeniority)
  );
  return clamp(100 - distance * 18);
}

function scoreDomain(jobText: string, cvText: string): number {
  const jobSignals = DOMAIN_PATTERNS.filter((signal) => jobText.includes(signal));
  const cvSignals = DOMAIN_PATTERNS.filter((signal) => cvText.includes(signal));

  if (jobSignals.length === 0) {
    return 70;
  }

  const matched = jobSignals.filter((signal) => cvSignals.includes(signal));
  if (matched.length === 0) {
    return 35;
  }

  return clamp(40 + (matched.length / jobSignals.length) * 60);
}

function scoreCommunication(jobText: string, cvText: string): number {
  const jobNeedsCommunication =
    /(communication|collaboration|cross-functional|stakeholder|teams|support|troubleshoot|webhook)/.test(jobText);
  const cvHasCommunication =
    /(communication|collaboration|cross-functional|stakeholder|teams|support|troubleshoot|root-cause|english|engleza)/.test(cvText);

  if (!jobNeedsCommunication) {
    return 65;
  }

  return cvHasCommunication ? 82 : 52;
}

function verdictFromScore(score: number): MatchResponse["verdict"] {
  if (score >= 75) {
    return "strong-fit";
  }

  if (score >= 50) {
    return "partial-fit";
  }

  return "weak-fit";
}

function summaryFromResult(
  score: number,
  matched: string[],
  missing: string[],
  clearlyDifferentDomains: boolean
): string {
  const matchedCount = matched.length;
  const missingCount = missing.length;

  if (clearlyDifferentDomains) {
    return "Job description-ul apartine unui domeniu complet diferit fata de profilul tehnic din CV, deci potrivirea reala este foarte mica.";
  }

  if (score >= 75) {
    return `CV-ul acopera bine cerintele rolului: ${matchedCount} cerinte tehnice cheie sunt sustinute clar, iar gap-urile ramase sunt mai degraba punctuale${missingCount > 0 ? ` (${missing.slice(0, 3).join(", ")})` : ""}.`;
  }

  if (score >= 50) {
    return `Exista overlap tehnic real intre CV si JD: ${matchedCount} cerinte cheie sunt acoperite, dar lipsesc sau nu sunt explicite cateva elemente importante${missingCount > 0 ? ` precum ${missing.slice(0, 3).join(", ")}` : ""}.`;
  }

  return `Potrivirea este limitata: doar ${matchedCount} cerinte cheie apar suficient de clar in CV, iar diferentele principale sunt${missingCount > 0 ? ` ${missing.slice(0, 4).join(", ")}` : " multiple cerinte esentiale"}.`;
}

export function evaluateMatch(jobDescription: string, cv: string): MatchResponse {
  const normalizedJob = normalize(jobDescription);
  const normalizedCv = normalize(cv);

  const jobKeywords = extractKeywordMatches(normalizedJob);
  const cvKeywords = extractKeywordMatches(normalizedCv);
  const skillResult = scoreSkills(jobKeywords, cvKeywords);
  const jobLooksTechnical = looksTechnical(normalizedJob);
  const cvLooksTechnical = looksTechnical(normalizedCv);
  const clearlyDifferentDomains = !jobLooksTechnical && cvLooksTechnical;

  const breakdown: ScoreBreakdown = {
    skills: Math.round(skillResult.score),
    experience: Math.round(scoreExperience(normalizedJob, normalizedCv)),
    seniority: Math.round(scoreSeniority(normalizedJob, normalizedCv)),
    domain: Math.round(scoreDomain(normalizedJob, normalizedCv)),
    communication: Math.round(scoreCommunication(normalizedJob, normalizedCv))
  };

  let matchScore = Math.round(
    clamp(
      breakdown.skills * 0.5 +
        breakdown.experience * 0.18 +
        breakdown.seniority * 0.1 +
        breakdown.domain * 0.12 +
        breakdown.communication * 0.1
      )
  );

  if (clearlyDifferentDomains) {
    // Un JD non-tehnic si un CV tehnic nu ofera dovezi comparabile pentru
    // niciuna dintre categoriile de potrivire. Nu afisam scoruri implicite
    // pentru senioritate, experienta sau colaborare in acest caz.
    breakdown.skills = 0;
    breakdown.experience = 0;
    breakdown.seniority = 0;
    breakdown.domain = 0;
    breakdown.communication = 0;
    matchScore = 0;
  } else {
    if (skillResult.matched.length >= 5) {
      matchScore = Math.max(matchScore, 60);
    }

    if (skillResult.matched.length >= 7) {
      matchScore = Math.max(matchScore, 70);
    }
  }

  const verdict = verdictFromScore(matchScore);

  const strengths = [
    clearlyDifferentDomains
      ? null
      : skillResult.matched.length > 0
        ? `CV-ul sustine explicit ${skillResult.matched.slice(0, 6).join(", ")}.`
        : null,
    clearlyDifferentDomains
      ? null
      : breakdown.experience >= 75
        ? "Experienta declarata este suficient de solida pentru un rol DevOps orientat pe infrastructura si livrare."
        : null,
    clearlyDifferentDomains
      ? null
      : breakdown.domain >= 75
        ? "Profilul ramane in aceeasi zona tehnica: cloud, infrastructura, deployment si observability."
        : null,
    clearlyDifferentDomains
      ? null
      : breakdown.communication >= 80
        ? "Apar semnale bune de troubleshooting, support si colaborare cu alte echipe."
        : null
  ].filter((value): value is string => Boolean(value));

  const risks = [
    clearlyDifferentDomains
      ? "Job description-ul descrie un rol din alt domeniu decat profilul tehnic din CV."
      : null,
    !clearlyDifferentDomains && skillResult.missing.length > 0
      ? `Nu apar dovezi suficient de clare pentru ${skillResult.missing.slice(0, 5).join(", ")}.`
      : null,
    jobKeywords.includes("sentry") && !cvKeywords.includes("sentry")
      ? "CV-ul nu mentioneaza Sentry, desi apare in cerinte."
      : null,
    jobKeywords.includes("unity_cloud_build") && !cvKeywords.includes("unity_cloud_build")
      ? "Nu exista experienta explicita cu Unity Cloud Build."
      : null
  ].filter((value): value is string => Boolean(value));

  const recommendations = [
    clearlyDifferentDomains
      ? "Pentru acest JD ai nevoie de un CV din acelasi domeniu; profilul DevOps actual nu trebuie fortat pe un rol sportiv."
      : null,
    !clearlyDifferentDomains && skillResult.missing.length > 0
      ? `Daca ai facut asta in practica, scoate mai clar in CV experienta cu ${skillResult.missing.slice(0, 4).join(", ")}.`
      : null,
    jobKeywords.includes("github_actions") && !cvKeywords.includes("github_actions")
      ? "Pune un exemplu concret de pipeline in GitHub Actions, daca ai folosit deja acest tool."
      : null,
    jobKeywords.includes("teams") && !cvKeywords.includes("teams")
      ? "Daca ai configurat notificari sau integrari in Microsoft Teams, merita mentionate explicit."
      : null,
    !clearlyDifferentDomains
      ? "Leaga fiecare rol de impact operational: uptime, timp de deploy, automatizare, incidente rezolvate."
      : null
  ].filter((value): value is string => Boolean(value));

  if (strengths.length === 0) {
    strengths.push(
      clearlyDifferentDomains
        ? "Nu exista puncte forte relevante deoarece JD-ul nu apartine aceluiasi domeniu profesional."
        : "Nu exista suficiente suprapuneri clare pentru a evidentia puncte forte solide."
    );
  }

  return {
    matchScore,
    verdict,
    summary: summaryFromResult(
      matchScore,
      skillResult.matched,
      skillResult.missing,
      clearlyDifferentDomains
    ),
    matchedKeywords: skillResult.matched,
    missingKeywords: skillResult.missing,
    strengths,
    risks,
    recommendations,
    breakdown
  };
}
