export type ScoreBreakdown = {
  skills: number;
  experience: number;
  seniority: number;
  domain: number;
  communication: number;
};

export type MatchResponse = {
  matchScore: number;
  verdict: "strong-fit" | "partial-fit" | "weak-fit";
  summary: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  risks: string[];
  recommendations: string[];
  breakdown: ScoreBreakdown;
};

