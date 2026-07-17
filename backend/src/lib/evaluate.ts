import { DOMAIN_TAXONOMY, type DomainDefinition } from "./domain-taxonomy.js";
import { DomainInsight, MatchResponse, ScoreBreakdown } from "../types.js";

const SENIORITY_PATTERNS: Array<{ label: string; pattern: RegExp; weight: number }> = [
  { label: "intern", pattern: /\bintern(ship)?\b/, weight: 1 },
  { label: "junior", pattern: /\bjunior\b/, weight: 2 },
  { label: "mid", pattern: /\b(mid|middle|mid-level)\b/, weight: 3 },
  { label: "senior", pattern: /\bsenior\b/, weight: 4 },
  { label: "lead", pattern: /\b(lead|team lead|tech lead)\b/, weight: 5 },
  { label: "staff", pattern: /\bstaff\b/, weight: 6 },
  { label: "principal", pattern: /\bprincipal\b/, weight: 7 },
  { label: "manager", pattern: /\bmanager\b/, weight: 5 }
];

const COMMUNICATION_SIGNALS = [
  "communication",
  "communicate",
  "collaboration",
  "collaborate",
  "stakeholder",
  "client",
  "customer",
  "teamwork",
  "leadership",
  "presentation",
  "training",
  "support",
  "negotiation",
  "english",
  "romanian",
  "coordination"
];

const REQUIREMENT_PREFIXES = [
  "experience with",
  "experience in",
  "knowledge of",
  "ability to",
  "responsible for",
  "must have",
  "required",
  "preferred",
  "familiarity with",
  "proficient in",
  "skilled in"
];

type DomainScore = {
  definition: DomainDefinition;
  score: number;
  evidence: string[];
};

type RequirementSignal = {
  key: string;
  label: string;
  importance: "core" | "supporting";
  evidence: string[];
};

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

function titleCaseLabel(value: string): string {
  return value
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function collectMatches(text: string, values: string[]): string[] {
  return unique(values.filter((value) => text.includes(value.toLowerCase())));
}

function buildDomainScore(text: string, definition: DomainDefinition): DomainScore {
  const aliasMatches = collectMatches(text, definition.aliases);
  const roleMatches = collectMatches(text, definition.roles);
  const toolMatches = collectMatches(text, definition.tools);
  const activityMatches = collectMatches(text, definition.activities);
  const score =
    aliasMatches.length * 2 +
    roleMatches.length * 5 +
    toolMatches.length * 3 +
    activityMatches.length * 2;

  return {
    definition,
    score,
    evidence: unique([
      ...roleMatches,
      ...toolMatches,
      ...activityMatches,
      ...aliasMatches
    ]).slice(0, 8)
  };
}

function detectDomain(text: string): DomainInsight {
  const scores = DOMAIN_TAXONOMY.map((definition) => buildDomainScore(text, definition))
    .sort((left, right) => right.score - left.score);
  const topScore = scores[0];
  const secondScore = scores[1];

  if (!topScore || topScore.score === 0) {
    return {
      key: "general",
      label: "General",
      confidence: 18,
      evidence: []
    };
  }

  const confidence = clamp(
    35 + topScore.score * 6 + Math.max(0, topScore.score - (secondScore?.score ?? 0)) * 3,
    0,
    100
  );

  return {
    key: topScore.definition.key,
    label: topScore.definition.label,
    confidence,
    evidence: topScore.evidence
  };
}

function extractYears(text: string): number[] {
  const matches = [...text.matchAll(/(\d{1,2})\+?\s*(years|year|yrs|ani)/g)];
  return matches.map((match) => Number(match[1])).filter(Number.isFinite);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function detectSeniority(text: string): { label: string; weight: number } | null {
  const match = SENIORITY_PATTERNS.find(({ pattern }) => pattern.test(text));
  return match ? { label: match.label, weight: match.weight } : null;
}

function extractRequirements(text: string, domain: DomainInsight): RequirementSignal[] {
  const definition = DOMAIN_TAXONOMY.find((candidate) => candidate.key === domain.key);
  const domainSignals = definition
    ? [
        ...definition.roles,
        ...definition.tools,
        ...definition.activities
      ]
    : [];
  const signals = unique(domainSignals)
    .filter((value) => text.includes(value.toLowerCase()))
    .map<RequirementSignal>((value, index) => ({
      key: value.replace(/\s+/g, "-"),
      label: titleCaseLabel(value),
      importance: index < 5 ? "core" : "supporting",
      evidence: [value]
    }));

  const phraseSignals = REQUIREMENT_PREFIXES.flatMap((prefix) => {
    const matches = [...text.matchAll(new RegExp(`${prefix}\\s+([\\p{L}\\p{N}+#./ -]{3,60})`, "gu"))];
    return matches.map((match) => match[1].trim().slice(0, 60));
  })
    .map((phrase) => phrase.replace(/\s+/g, " ").trim())
    .filter((phrase) => phrase.length >= 4)
    .filter((phrase) => !signals.some((signal) => signal.evidence.includes(phrase)));

  return unique([
    ...signals.map((signal) => signal.label),
    ...phraseSignals.map((phrase) => titleCaseLabel(phrase))
  ])
    .slice(0, 14)
    .map((label, index) => ({
      key: label.toLowerCase().replace(/\s+/g, "-"),
      label,
      importance: index < 6 ? "core" : "supporting",
      evidence: [label.toLowerCase()]
    }));
}

function isRequirementCovered(requirement: RequirementSignal, cvText: string): boolean {
  return requirement.evidence.some((evidence) => cvText.includes(evidence.toLowerCase()));
}

function scoreSkills(jobRequirements: RequirementSignal[], cvText: string) {
  if (jobRequirements.length === 0) {
    return {
      score: 45,
      matched: [] as string[],
      missing: [] as string[]
    };
  }

  const matched = jobRequirements
    .filter((requirement) => isRequirementCovered(requirement, cvText))
    .map((requirement) => requirement.label);
  const missing = jobRequirements
    .filter((requirement) => !isRequirementCovered(requirement, cvText))
    .map((requirement) => requirement.label);
  const core = jobRequirements.filter((requirement) => requirement.importance === "core");
  const supporting = jobRequirements.filter((requirement) => requirement.importance === "supporting");
  const matchedCore = core.filter((requirement) => isRequirementCovered(requirement, cvText));
  const matchedSupporting = supporting.filter((requirement) => isRequirementCovered(requirement, cvText));
  const coreRatio = core.length > 0 ? matchedCore.length / core.length : 0.5;
  const supportingRatio = supporting.length > 0 ? matchedSupporting.length / supporting.length : 0.5;

  return {
    score: clamp(coreRatio * 78 + supportingRatio * 22),
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

  if (cvLevel >= 6) {
    return 88;
  }

  if (cvLevel >= 3) {
    return 74;
  }

  if (cvLevel > 0) {
    return 60;
  }

  return 48;
}

function scoreSeniority(jobText: string, cvText: string): number {
  const jobSeniority = detectSeniority(jobText);
  const cvSeniority = detectSeniority(cvText);

  if (!jobSeniority && !cvSeniority) {
    return 60;
  }

  if (!jobSeniority || !cvSeniority) {
    return 54;
  }

  return clamp(100 - Math.abs(jobSeniority.weight - cvSeniority.weight) * 16);
}

function scoreDomain(jobDomain: DomainInsight, cvDomain: DomainInsight): number {
  if (jobDomain.key === "general" || cvDomain.key === "general") {
    return 42;
  }

  if (jobDomain.key === cvDomain.key) {
    return clamp(74 + Math.min(jobDomain.confidence, cvDomain.confidence) * 0.26);
  }

  return 12;
}

function scoreCommunication(jobText: string, cvText: string): number {
  const jobSignals = collectMatches(jobText, COMMUNICATION_SIGNALS);
  const cvSignals = collectMatches(cvText, COMMUNICATION_SIGNALS);

  if (jobSignals.length === 0) {
    return cvSignals.length > 0 ? 70 : 60;
  }

  const overlap = jobSignals.filter((signal) => cvSignals.includes(signal));

  if (overlap.length === 0) {
    return 46;
  }

  return clamp(52 + (overlap.length / jobSignals.length) * 48);
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
  domainMismatch: boolean,
  cvDomain: DomainInsight,
  jobDomain: DomainInsight
): string {
  if (domainMismatch) {
    return `CV-ul pare din domeniul ${cvDomain.label}, iar jobul apartine domeniului ${jobDomain.label}, deci potrivirea reala este foarte mica chiar daca exista cateva cuvinte comune.`;
  }

  if (score >= 75) {
    return `CV-ul se potriveste bine cu rolul din ${jobDomain.label}: acopera clar ${matched.length} cerinte importante, iar golurile ramase sunt limitate${missing.length > 0 ? ` (${missing.slice(0, 3).join(", ")})` : ""}.`;
  }

  if (score >= 50) {
    return `Exista o potrivire partiala in domeniul ${jobDomain.label}: unele cerinte sunt acoperite (${matched.slice(0, 4).join(", ") || "cateva competente relevante"}), dar lipsesc sau nu sunt explicite alte elemente cheie${missing.length > 0 ? ` precum ${missing.slice(0, 3).join(", ")}` : ""}.`;
  }

  return `Potrivirea este slaba pentru acest rol din ${jobDomain.label}: dovezile din CV sunt limitate, iar diferentele principale sunt${missing.length > 0 ? ` ${missing.slice(0, 4).join(", ")}` : " mai multe cerinte esentiale neacoperite"}.`;
}

export function evaluateMatch(jobDescription: string, cv: string): MatchResponse {
  const normalizedJob = normalize(jobDescription);
  const normalizedCv = normalize(cv);
  const detectedJobDomain = detectDomain(normalizedJob);
  const detectedCvDomain = detectDomain(normalizedCv);
  const domainMismatch =
    detectedJobDomain.key !== "general" &&
    detectedCvDomain.key !== "general" &&
    detectedJobDomain.key !== detectedCvDomain.key &&
    detectedJobDomain.confidence >= 55 &&
    detectedCvDomain.confidence >= 55;
  const jobRequirements = extractRequirements(normalizedJob, detectedJobDomain);
  const skillResult = scoreSkills(jobRequirements, normalizedCv);

  const breakdown: ScoreBreakdown = {
    skills: Math.round(skillResult.score),
    experience: Math.round(scoreExperience(normalizedJob, normalizedCv)),
    seniority: Math.round(scoreSeniority(normalizedJob, normalizedCv)),
    domain: Math.round(scoreDomain(detectedJobDomain, detectedCvDomain)),
    communication: Math.round(scoreCommunication(normalizedJob, normalizedCv))
  };

  let matchScore = Math.round(
    clamp(
      breakdown.skills * 0.44 +
        breakdown.experience * 0.16 +
        breakdown.seniority * 0.1 +
        breakdown.domain * 0.22 +
        breakdown.communication * 0.08
    )
  );

  if (domainMismatch) {
    breakdown.skills = Math.min(breakdown.skills, 24);
    breakdown.experience = Math.min(breakdown.experience, 35);
    breakdown.seniority = Math.min(breakdown.seniority, 35);
    breakdown.domain = 0;
    breakdown.communication = Math.min(breakdown.communication, 40);
    matchScore = Math.min(matchScore, 18);
  }

  const verdict = verdictFromScore(matchScore);
  const strengths = [
    detectedCvDomain.key !== "general"
      ? `CV-ul arata un profil clar in domeniul ${detectedCvDomain.label}.`
      : null,
    skillResult.matched.length > 0
      ? `CV-ul sustine explicit ${skillResult.matched.slice(0, 5).join(", ")}.`
      : null,
    breakdown.experience >= 75
      ? "Experienta descrisa pare suficient de consistenta pentru nivelul cerut de rol."
      : null,
    breakdown.communication >= 75
      ? "Apar dovezi bune de colaborare, comunicare sau lucru direct cu clienti si colegi."
      : null
  ].filter((value): value is string => Boolean(value));

  const risks = [
    domainMismatch
      ? `Domeniul CV-ului (${detectedCvDomain.label}) nu coincide cu domeniul rolului (${detectedJobDomain.label}).`
      : null,
    skillResult.missing.length > 0
      ? `Nu apar dovezi suficient de clare pentru ${skillResult.missing.slice(0, 5).join(", ")}.`
      : null,
    breakdown.experience < 55
      ? "Nivelul de experienta cerut nu este sustinut suficient de clar de CV."
      : null,
    detectedJobDomain.confidence < 45
      ? "Job description-ul este vag, ceea ce reduce precizia evaluarii automate."
      : null
  ].filter((value): value is string => Boolean(value));

  const recommendations = [
    skillResult.missing.length > 0
      ? `Daca ai facut deja asta in practica, fa mai explicite in CV cerintele ${skillResult.missing.slice(0, 4).join(", ")}.`
      : null,
    detectedCvDomain.key === "general"
      ? "Descrie mai clar rolurile, uneltele si responsabilitatile ca sistemul sa poata identifica mai precis domeniul tau."
      : null,
    domainMismatch
      ? `Pentru acest job ai nevoie de un CV orientat pe ${detectedJobDomain.label}, nu de o rescriere artificiala a experientei actuale.`
      : "Leaga fiecare experienta de rezultate concrete: responsabilitati, unelte folosite si impact."
  ].filter((value): value is string => Boolean(value));

  if (strengths.length === 0) {
    strengths.push(
      domainMismatch
        ? "Nu exista puncte forte relevante deoarece rolul si profilul par sa fie din domenii diferite."
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
      domainMismatch,
      detectedCvDomain,
      detectedJobDomain
    ),
    detectedCvDomain,
    detectedJobDomain,
    domainMismatch,
    matchedKeywords: skillResult.matched,
    missingKeywords: skillResult.missing,
    strengths,
    risks,
    recommendations,
    breakdown
  };
}
