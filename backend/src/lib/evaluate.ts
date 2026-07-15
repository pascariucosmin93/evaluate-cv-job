import { MatchResponse, ScoreBreakdown } from "../types.js";

const KEYWORD_GROUPS: Record<string, string[]> = {
  javascript: ["javascript", "js", "ecmascript"],
  typescript: ["typescript", "ts"],
  react: ["react", "react.js", "next.js", "nextjs"],
  nextjs: ["next.js", "nextjs"],
  node: ["node", "node.js", "nodejs", "express", "nest", "fastify"],
  python: ["python", "fastapi", "django", "flask"],
  java: ["java", "spring", "spring boot"],
  dotnet: [".net", "c#", "asp.net"],
  sql: ["sql", "postgres", "postgresql", "mysql", "mariadb", "sql server"],
  nosql: ["mongodb", "redis", "elasticsearch", "dynamodb", "cassandra"],
  docker: ["docker", "container", "containers"],
  kubernetes: ["kubernetes", "k8s", "helm", "argo cd", "argocd"],
  aws: ["aws", "ec2", "ecs", "eks", "lambda", "cloudformation"],
  gcp: ["gcp", "google cloud", "gke", "bigquery"],
  azure: ["azure", "aks", "functions"],
  ci_cd: ["ci/cd", "ci cd", "github actions", "gitlab ci", "jenkins"],
  testing: ["testing", "jest", "vitest", "cypress", "playwright", "unit test"],
  api: ["api", "rest", "graphql", "microservices", "integration"],
  leadership: ["leadership", "mentor", "mentoring", "team lead", "ownership"],
  communication: ["communication", "stakeholder", "collaboration", "cross-functional"],
  english: ["english", "engleza", "fluent english", "business english"],
  remote: ["remote", "distributed", "hybrid"]
};

const SENIORITY_HINTS = [
  "intern",
  "junior",
  "mid",
  "middle",
  "senior",
  "lead",
  "staff",
  "principal",
  "manager"
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

function extractMatchedKeywords(text: string): string[] {
  const matched = Object.entries(KEYWORD_GROUPS)
    .filter(([, aliases]) => aliases.some((alias) => text.includes(alias)))
    .map(([keyword]) => keyword);

  return unique(matched);
}

function extractYears(text: string): number[] {
  const matches = [...text.matchAll(/(\d{1,2})\+?\s*(years|year|yrs|ani)/g)];
  return matches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value));
}

function detectSeniority(text: string): string | null {
  return SENIORITY_HINTS.find((hint) => text.includes(hint)) ?? null;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function scoreSkills(jobKeywords: string[], cvKeywords: string[]) {
  if (jobKeywords.length === 0) {
    return {
      score: 70,
      matched: [],
      missing: []
    };
  }

  const matched = jobKeywords.filter((keyword) => cvKeywords.includes(keyword));
  const missing = jobKeywords.filter((keyword) => !cvKeywords.includes(keyword));

  return {
    score: (matched.length / jobKeywords.length) * 100,
    matched,
    missing
  };
}

function scoreExperience(jobText: string, cvText: string): number {
  const jobYears = extractYears(jobText);
  const cvYears = extractYears(cvText);
  const jobTarget = Math.max(...jobYears, 0);
  const cvLevel = Math.max(...cvYears, average(cvYears));

  if (jobTarget === 0 && cvLevel === 0) {
    return 65;
  }

  if (jobTarget === 0) {
    return 85;
  }

  if (cvLevel === 0) {
    return 35;
  }

  return clamp((cvLevel / jobTarget) * 100);
}

function scoreSeniority(jobText: string, cvText: string): number {
  const jobSeniority = detectSeniority(jobText);
  const cvSeniority = detectSeniority(cvText);

  if (!jobSeniority && !cvSeniority) {
    return 70;
  }

  if (!jobSeniority || !cvSeniority) {
    return 55;
  }

  if (jobSeniority === cvSeniority) {
    return 100;
  }

  const order = ["intern", "junior", "mid", "middle", "senior", "lead", "staff", "principal", "manager"];
  const distance = Math.abs(order.indexOf(jobSeniority) - order.indexOf(cvSeniority));
  return clamp(100 - distance * 18);
}

function scoreDomain(jobText: string, cvText: string): number {
  const signals = ["saas", "ecommerce", "fintech", "healthcare", "b2b", "b2c", "marketplace", "startup"];
  const jobSignals = signals.filter((signal) => jobText.includes(signal));
  const cvSignals = signals.filter((signal) => cvText.includes(signal));

  if (jobSignals.length === 0) {
    return 70;
  }

  const matched = jobSignals.filter((signal) => cvSignals.includes(signal));
  return clamp((matched.length / jobSignals.length) * 100);
}

function scoreCommunication(jobText: string, cvText: string): number {
  const jobNeedsCommunication = /(communication|stakeholder|collaboration|cross-functional|english|engleza)/.test(jobText);
  const cvHasCommunication = /(communication|stakeholder|collaboration|cross-functional|english|engleza)/.test(cvText);

  if (!jobNeedsCommunication) {
    return 75;
  }

  return cvHasCommunication ? 90 : 45;
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

function summaryFromScore(score: number, missingKeywords: string[]): string {
  if (score >= 75) {
    return missingKeywords.length > 0
      ? "Profilul se potriveste bine, dar exista cateva lipsuri punctuale fata de cerintele rolului."
      : "Profilul se aliniaza foarte bine cu cerintele rolului.";
  }

  if (score >= 50) {
    return "Exista o baza relevanta pentru rol, dar sunt cateva gap-uri care pot reduce sansele la screening.";
  }

  return "Potrivirea este limitata in acest moment, mai ales pe cerintele esentiale sau senioritate.";
}

export function evaluateMatch(jobDescription: string, cv: string): MatchResponse {
  const normalizedJob = normalize(jobDescription);
  const normalizedCv = normalize(cv);

  const jobKeywords = extractMatchedKeywords(normalizedJob);
  const cvKeywords = extractMatchedKeywords(normalizedCv);
  const skillResult = scoreSkills(jobKeywords, cvKeywords);

  const breakdown: ScoreBreakdown = {
    skills: Math.round(skillResult.score),
    experience: Math.round(scoreExperience(normalizedJob, normalizedCv)),
    seniority: Math.round(scoreSeniority(normalizedJob, normalizedCv)),
    domain: Math.round(scoreDomain(normalizedJob, normalizedCv)),
    communication: Math.round(scoreCommunication(normalizedJob, normalizedCv))
  };

  const weightedScore =
    breakdown.skills * 0.42 +
    breakdown.experience * 0.2 +
    breakdown.seniority * 0.16 +
    breakdown.domain * 0.12 +
    breakdown.communication * 0.1;

  const matchScore = Math.round(clamp(weightedScore));
  const verdict = verdictFromScore(matchScore);

  const strengths = [
    skillResult.matched.length > 0 ? `Ai acoperire pe ${skillResult.matched.slice(0, 5).join(", ")}.` : null,
    breakdown.experience >= 75 ? "Experienta declarata pare aliniata cu nivelul cerut." : null,
    breakdown.seniority >= 80 ? "Seniority-ul sugerat de CV este apropiat de nivelul rolului." : null,
    breakdown.communication >= 80 ? "CV-ul contine semnale bune de colaborare, stakeholder management sau engleza." : null
  ].filter((value): value is string => Boolean(value));

  const risks = [
    skillResult.missing.length > 0 ? `Lipsesc semnale clare pentru ${skillResult.missing.slice(0, 6).join(", ")}.` : null,
    breakdown.experience < 60 ? "Experienta mentionata pare sub nivelul cerut in JD." : null,
    breakdown.seniority < 60 ? "Seniority-ul pare posibil sub sau peste nivelul cautat." : null,
    breakdown.domain < 55 ? "Nu apar suficiente indicii ca ai experienta in acelasi tip de produs sau industrie." : null
  ].filter((value): value is string => Boolean(value));

  const recommendations = [
    skillResult.missing.length > 0 ? `Evidentiaza explicit in CV experienta cu ${skillResult.missing.slice(0, 4).join(", ")} daca exista.` : null,
    breakdown.experience < 70 ? "Fa mai vizibili anii de experienta si impactul pe fiecare rol." : null,
    breakdown.communication < 70 ? "Adauga exemple de colaborare cross-functional, prezentari sau stakeholder management." : null,
    "Adapteaza sumarul CV-ului pe limbajul si tehnologiile din JD inainte de aplicare."
  ].filter((value): value is string => Boolean(value));

  return {
    matchScore,
    verdict,
    summary: summaryFromScore(matchScore, skillResult.missing),
    matchedKeywords: skillResult.matched,
    missingKeywords: skillResult.missing,
    strengths,
    risks,
    recommendations,
    breakdown
  };
}

