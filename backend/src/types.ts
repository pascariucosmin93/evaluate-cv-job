export type ScoreBreakdown = {
  skills: number;
  experience: number;
  seniority: number;
  domain: number;
  communication: number;
};

export type DomainInsight = {
  key: string;
  label: string;
  confidence: number;
  evidence: string[];
};

export type MatchResponse = {
  matchScore: number;
  verdict: "strong-fit" | "partial-fit" | "weak-fit";
  summary: string;
  detectedCvDomain: DomainInsight;
  detectedJobDomain: DomainInsight;
  domainMismatch: boolean;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  risks: string[];
  recommendations: string[];
  breakdown: ScoreBreakdown;
};

export type TailoredCvResponse = {
  tailoredCv: string;
  changesSummary: string[];
  notes: string[];
  addedSkills: string[];
  rejectedSkills: string[];
  blocked: boolean;
  blockReason: string | null;
};

export type JobPayload = {
  jobDescription: string;
  cv: string;
  jobTitle?: string;
};

export type EvaluationApiResponse = MatchResponse & {
  jobTitle: string | null;
};

export type TailoredCvApiResponse = TailoredCvResponse & {
  jobTitle: string | null;
};

export type JobType = "evaluate" | "tailor-cv";
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type JobResult = EvaluationApiResponse | TailoredCvApiResponse;

export type JobRecord = {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: JobPayload;
  result: JobResult | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};
