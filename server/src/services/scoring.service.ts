import type {
  CompetitionScoringPolicy,
  ScoringTotalSource,
} from "../models/competition.model";
import type { EvaluationCriterion } from "../models/evaluation.model";
import type { RoundIdentifier } from "../types/domain.types";

export interface CriterionScoreDetail {
  parameterId: string;
  parameterName: string;
  awardedMarks: number;
  maxMarks: number;
  weightage: number;
  percentage: number;
}

export interface JudgeEvaluationScore {
  rawTotalMarks: number;
  maxPossibleMarks: number;
  normalizedScore: number;
  criteriaScores: CriterionScoreDetail[];
}

export function calculateJudgeEvaluationScore(
  criteria: EvaluationCriterion[],
  totalSource: ScoringTotalSource = "derived",
  fixedTotal: number | null = null,
): JudgeEvaluationScore {
  let rawTotalMarks = 0;
  let maxPossibleMarks = 0;
  let weightedPointsSum = 0;
  let totalWeight = 0;

  const criteriaScores: CriterionScoreDetail[] = [];

  for (const criterion of criteria) {
    const awarded = criterion.awardedMarks;
    const max = criterion.maxMarks;
    const weight = criterion.weightage > 0 ? criterion.weightage : 1;

    rawTotalMarks += awarded;
    maxPossibleMarks += max;

    const percentage = max > 0 ? (awarded / max) * 100 : 0;
    weightedPointsSum += percentage * weight;
    totalWeight += weight;

    criteriaScores.push({
      parameterId: criterion.parameter.toString(),
      parameterName: criterion.parameterName,
      awardedMarks: awarded,
      maxMarks: max,
      weightage: criterion.weightage,
      percentage: Number(percentage.toFixed(4)),
    });
  }

  const overallPercentage =
    totalWeight > 0 ? weightedPointsSum / totalWeight : 0;

  let normalizedScore: number;
  if (totalSource === "fixed" && fixedTotal !== null && fixedTotal > 0) {
    normalizedScore = Number(((overallPercentage / 100) * fixedTotal).toFixed(4));
  } else {
    normalizedScore = Number(overallPercentage.toFixed(4));
  }

  return {
    rawTotalMarks: Number(rawTotalMarks.toFixed(4)),
    maxPossibleMarks: Number(maxPossibleMarks.toFixed(4)),
    normalizedScore,
    criteriaScores,
  };
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

export interface RawJudgeEvaluation {
  judgeId: string;
  criteria: EvaluationCriterion[];
}

export function aggregateParticipantRoundScores(
  round: RoundIdentifier,
  evaluations: RawJudgeEvaluation[],
  panelJudgeCount: number,
  scoringPolicy?: CompetitionScoringPolicy,
): ParticipantRoundResult {
  const totalSource = scoringPolicy?.totalSource ?? "derived";
  const fixedTotal = scoringPolicy?.fixedTotal ?? null;

  if (evaluations.length === 0) {
    return {
      round,
      roundScore: 0,
      rawAverageMarks: 0,
      maxPossibleMarks: 0,
      judgeCount: 0,
      panelJudgeCount,
      isComplete: false,
      judgeScores: [],
    };
  }

  let totalRawMarks = 0;
  let totalNormalizedScore = 0;
  let maxPossibleMarks = 0;

  const judgeScores: ParticipantRoundResult["judgeScores"] = [];

  for (const evalItem of evaluations) {
    const score = calculateJudgeEvaluationScore(
      evalItem.criteria,
      totalSource,
      fixedTotal,
    );
    totalRawMarks += score.rawTotalMarks;
    totalNormalizedScore += score.normalizedScore;
    maxPossibleMarks = Math.max(maxPossibleMarks, score.maxPossibleMarks);

    judgeScores.push({
      judgeId: evalItem.judgeId,
      rawTotalMarks: score.rawTotalMarks,
      normalizedScore: score.normalizedScore,
    });
  }

  const judgeCount = evaluations.length;
  const roundScore = Number((totalNormalizedScore / judgeCount).toFixed(4));
  const rawAverageMarks = Number((totalRawMarks / judgeCount).toFixed(4));
  const isComplete = panelJudgeCount > 0 && judgeCount >= panelJudgeCount;

  return {
    round,
    roundScore,
    rawAverageMarks,
    maxPossibleMarks,
    judgeCount,
    panelJudgeCount,
    isComplete,
    judgeScores,
  };
}

export interface RoundWeights {
  round1?: number;
  round2?: number;
}

export interface ParticipantOverallScore {
  totalScore: number;
  rawTotalMarks: number;
  roundResults: Partial<Record<RoundIdentifier, ParticipantRoundResult>>;
}

export function calculateParticipantOverallScore(
  roundResults: Partial<Record<RoundIdentifier, ParticipantRoundResult>>,
  weights?: RoundWeights,
): ParticipantOverallScore {
  const r1 = roundResults[1];
  const r2 = roundResults[2];

  let rawTotalMarks = 0;
  if (r1) rawTotalMarks += r1.rawAverageMarks;
  if (r2) rawTotalMarks += r2.rawAverageMarks;
  rawTotalMarks = Number(rawTotalMarks.toFixed(4));

  if (!r1 && !r2) {
    return { totalScore: 0, rawTotalMarks: 0, roundResults };
  }

  if (r1 && !r2) {
    return {
      totalScore: r1.roundScore,
      rawTotalMarks,
      roundResults,
    };
  }

  if (!r1 && r2) {
    return {
      totalScore: r2.roundScore,
      rawTotalMarks,
      roundResults,
    };
  }

  // Both rounds exist
  const w1 = weights?.round1 ?? 0.5;
  const w2 = weights?.round2 ?? 0.5;
  const totalWeight = w1 + w2;

  const totalScore =
    totalWeight > 0
      ? Number(((r1!.roundScore * w1 + r2!.roundScore * w2) / totalWeight).toFixed(4))
      : 0;

  return {
    totalScore,
    rawTotalMarks,
    roundResults,
  };
}

export interface LeaderboardEntryInput {
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

export interface RankedLeaderboardEntry extends LeaderboardEntryInput {
  rank: number;
}

export type TieBreakPolicy = "none" | "round2Priority" | "rawMarks";

export function rankLeaderboardEntries(
  entries: LeaderboardEntryInput[],
  tieBreakPolicy: TieBreakPolicy = "none",
): RankedLeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Primary: totalScore descending
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }

    // Tie-break policies
    if (tieBreakPolicy === "round2Priority") {
      const r2A = a.roundResults[2]?.roundScore ?? 0;
      const r2B = b.roundResults[2]?.roundScore ?? 0;
      if (r2B !== r2A) {
        return r2B - r2A;
      }
    } else if (tieBreakPolicy === "rawMarks") {
      if (b.rawTotalMarks !== a.rawTotalMarks) {
        return b.rawTotalMarks - a.rawTotalMarks;
      }
    }

    // Deterministic tie resolution for stable display ordering
    return a.registrationId.localeCompare(b.registrationId);
  });

  const ranked: RankedLeaderboardEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;

    if (i === 0) {
      ranked.push({ ...current, rank: 1 });
      continue;
    }

    const previous = sorted[i - 1]!;
    const isTied =
      current.totalScore === previous.totalScore &&
      (tieBreakPolicy !== "round2Priority" ||
        (current.roundResults[2]?.roundScore ?? 0) ===
          (previous.roundResults[2]?.roundScore ?? 0)) &&
      (tieBreakPolicy !== "rawMarks" ||
        current.rawTotalMarks === previous.rawTotalMarks);

    if (isTied) {
      // Shared rank (standard competition ranking: 1, 2, 2, 4...)
      const prevRanked = ranked[i - 1]!;
      ranked.push({ ...current, rank: prevRanked.rank });
    } else {
      ranked.push({ ...current, rank: i + 1 });
    }
  }

  return ranked;
}
