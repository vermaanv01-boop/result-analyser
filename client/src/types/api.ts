export type UserRole = "admin" | "judge" | "participant";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type RoundStatus = "pending" | "active" | "closed";
export type RoundIdentifier = 1 | 2;
export type CompetitionStatus = "draft" | "active" | "completed" | "archived";

export interface CompetitionRound {
  round: RoundIdentifier;
  status: RoundStatus;
  startedAt: string | null;
  closedAt: string | null;
}

export interface CompetitionScoringPolicy {
  totalSource: "fixed" | "derived";
  fixedTotal: number | null;
  normalization?: { method?: string | null; parameters?: Record<string, unknown> };
  aggregation?: { method?: string | null; parameters?: Record<string, unknown> };
  weightage?: { method?: string | null; parameters?: Record<string, unknown> };
}

export interface Competition {
  _id: string;
  name: string;
  description: string | null;
  status: CompetitionStatus;
  createdBy: { _id: string; name: string; email: string } | string;
  rounds: CompetitionRound[];
  scoringPolicy: CompetitionScoringPolicy;
  parameterConfigVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface Panel {
  _id: string;
  competition: string;
  name: string;
  description: string | null;
  judges: Array<{ _id: string; name: string; email: string; isActive: boolean }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantEligibility {
  round: RoundIdentifier;
  eligible: boolean;
  ineligibleReason: string | null;
  updatedAt: string;
}

export interface Participant {
  _id: string;
  competition: string;
  name: string;
  registrationId: string;
  email: string | null;
  panel: { _id: string; name: string; isActive: boolean } | string | null;
  isActive: boolean;
  eligibility: ParticipantEligibility[];
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationParameter {
  _id: string;
  competition: string;
  name: string;
  description: string | null;
  guidelines: string | null;
  maxMarks: number;
  weightage: number;
  applicableRounds: RoundIdentifier[];
  isActive: boolean;
  configVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationCriterion {
  parameter: string;
  configVersion: number;
  parameterName: string;
  maxMarks: number;
  weightage: number;
  applicableRounds: RoundIdentifier[];
  awardedMarks: number;
}

export interface Evaluation {
  _id: string;
  competition: string;
  participant: { _id: string; name: string; registrationId: string };
  panel: { _id: string; name: string };
  judge: { _id: string; name: string; email: string };
  round: RoundIdentifier;
  status: "draft" | "submitted";
  criteria: EvaluationCriterion[];
  parameterConfigVersion: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantRoundResult {
  round: RoundIdentifier;
  roundScore: number;
  rawAverageMarks: number;
  maxPossibleMarks: number;
  judgeCount: number;
  panelJudgeCount: number;
  isComplete: boolean;
  judgeScores: Array<{
    judgeId: string;
    rawTotalMarks: number;
    normalizedScore: number;
  }>;
}

export interface RankedLeaderboardEntry {
  rank: number;
  participantId: string;
  registrationId: string;
  participantName: string;
  panelId: string | null;
  panelName: string | null;
  isEligible: boolean;
  totalScore: number;
  rawTotalMarks: number;
  roundResults: Partial<Record<RoundIdentifier, ParticipantRoundResult>>;
}

export interface LeaderboardResult {
  competition: {
    id: string;
    name: string;
    status: string;
    parameterConfigVersion: number;
  };
  filter: {
    round: RoundIdentifier | "overall";
    panelId: string | null;
  };
  generatedAt: string;
  leaderboard: RankedLeaderboardEntry[];
}

export interface ProgressReport {
  competitionId: string;
  totalParticipants: number;
  totalPanels: number;
  activeRound: RoundIdentifier | null;
  panelProgress: Array<{
    panelId: string;
    panelName: string;
    judgeCount: number;
    participantCount: number;
    round1: { expected: number; submitted: number; isComplete: boolean };
    round2: { expected: number; submitted: number; isComplete: boolean };
  }>;
}
