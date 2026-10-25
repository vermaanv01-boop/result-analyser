import { Types } from "mongoose";
import { Competition, type CompetitionDocument } from "../models/competition.model";
import { Evaluation } from "../models/evaluation.model";
import { Panel } from "../models/panel.model";
import {
  Participant,
  type ParticipantDocument,
  type ParticipantEligibility,
} from "../models/participant.model";
import {
  aggregateParticipantRoundScores,
  calculateParticipantOverallScore,
  type ParticipantRoundResult,
  type RawJudgeEvaluation,
} from "./scoring.service";
import { ApiError } from "../utils/api-error";
import { generateUniqueRegistrationId } from "../utils/registration-id";
import type { RoundIdentifier } from "../types/domain.types";

export interface ParticipantProfileDTO {
  id: string;
  name: string;
  registrationId: string;
  email: string;
  teamMembers: string[];
  eligibility: ParticipantEligibility[];
  competition: {
    id: string;
    name: string;
    status: string;
    rounds: Array<{
      round: number;
      status: string;
    }>;
  };
  panel: {
    id: string;
    name: string;
    room: string | null;
  } | null;
}

export interface CriterionBreakdownDTO {
  parameterId: string;
  parameterName: string;
  awardedMarks: number;
  maxMarks: number;
  weightage: number;
  percentage: number;
}

export interface ParticipantRoundDetailDTO {
  round: RoundIdentifier;
  roundScore: number;
  rawAverageMarks: number;
  maxPossibleMarks: number;
  judgeCount: number;
  panelJudgeCount: number;
  isComplete: boolean;
  status: "pending" | "in_progress" | "evaluated";
  criteriaScores: CriterionBreakdownDTO[];
}

export interface ParticipantResultsDTO {
  competition: {
    id: string;
    name: string;
    status: string;
    scoringPolicy: {
      totalSource: string;
      fixedTotal: number | null;
    };
  };
  evaluationStatus: "pending" | "in_progress" | "completed";
  rounds: ParticipantRoundDetailDTO[];
  overallScore: number;
  rawTotalMarks: number;
  maxPossibleScore: number;
}

export async function findParticipantForUser(
  userId: string,
  userEmail: string,
): Promise<ParticipantDocument> {
  const normalizedEmail = userEmail.trim().toLowerCase();
  const userObjectId = new Types.ObjectId(userId);

  let participant = await Participant.findOne({
    $or: [{ user: userObjectId }, { email: normalizedEmail }],
  })
    .populate("competition", "name status rounds scoringPolicy")
    .populate("panel", "name room isLocked judges");

  if (!participant) {
    throw ApiError.notFound("Participant profile not found for this account");
  }

  // Link user if not already set
  if (!participant.user) {
    participant.user = userObjectId;
    await participant.save();
  }

  // Handle legacy accounts with missing IDs without creating duplicate accounts
  if (!participant.registrationId) {
    try {
      participant.registrationId = await generateUniqueRegistrationId(participant.competition, "REG");
      await participant.save();
    } catch (err) {
      console.error("Failed to generate registrationId for legacy participant:", err);
    }
  }

  return participant;
}

export async function getParticipantProfile(
  userId: string,
  userEmail: string,
): Promise<ParticipantProfileDTO> {
  const participant = await findParticipantForUser(userId, userEmail);

  const comp = participant.competition as unknown as (CompetitionDocument & { _id: Types.ObjectId });
  const panel = participant.panel as unknown as { _id: Types.ObjectId; name: string; room?: string | null } | null;

  return {
    id: participant._id.toString(),
    name: participant.name,
    registrationId: participant.registrationId,
    email: participant.email ?? userEmail,
    teamMembers: participant.teamMembers ?? [],
    eligibility: participant.eligibility,
    competition: {
      id: comp?._id?.toString() ?? "",
      name: comp?.name ?? "Unknown Competition",
      status: comp?.status ?? "active",
      rounds: comp?.rounds?.map((r) => ({ round: r.round, status: r.status })) ?? [],
    },
    panel: panel
      ? {
          id: panel._id.toString(),
          name: panel.name,
          room: panel.room ?? null,
        }
      : null,
  };
}

export async function getParticipantResults(
  userId: string,
  userEmail: string,
): Promise<ParticipantResultsDTO> {
  const participant = await findParticipantForUser(userId, userEmail);
  const comp = participant.competition as unknown as (CompetitionDocument & { _id: Types.ObjectId });

  // Only query SUBMITTED evaluations to ensure draft scores and private judge remarks are strictly hidden
  const submittedEvaluations = await Evaluation.find({
    participant: participant._id,
    status: "submitted",
  }).sort({ round: 1, submittedAt: 1 });

  // Get panel judge count
  let panelJudgeCount = 0;
  if (participant.panel) {
    const panelDoc = await Panel.findById(participant.panel);
    if (panelDoc) {
      panelJudgeCount = panelDoc.judges.length;
    }
  }

  // Group submitted evaluations by round
  const evalsByRound = new Map<RoundIdentifier, RawJudgeEvaluation[]>();
  const criteriaByRound = new Map<RoundIdentifier, Map<string, {
    parameterName: string;
    maxMarks: number;
    weightage: number;
    totalAwarded: number;
    evalCount: number;
  }>>();

  for (const evaluation of submittedEvaluations) {
    const round = evaluation.round as RoundIdentifier;
    if (!evalsByRound.has(round)) {
      evalsByRound.set(round, []);
    }
    evalsByRound.get(round)!.push({
      judgeId: evaluation.judge.toString(),
      criteria: evaluation.criteria,
    });

    // Aggregate criterion details without exposing judge-specific notes or names
    if (!criteriaByRound.has(round)) {
      criteriaByRound.set(round, new Map());
    }
    const critMap = criteriaByRound.get(round)!;

    for (const c of evaluation.criteria) {
      const paramKey = c.parameter.toString();
      const existing = critMap.get(paramKey);
      if (existing) {
        existing.totalAwarded += c.awardedMarks;
        existing.evalCount += 1;
      } else {
        critMap.set(paramKey, {
          parameterName: c.parameterName,
          maxMarks: c.maxMarks,
          weightage: c.weightage,
          totalAwarded: c.awardedMarks,
          evalCount: 1,
        });
      }
    }
  }

  // Compute round-wise results using scoring.service
  const roundResults: Partial<Record<RoundIdentifier, ParticipantRoundResult>> = {};
  const roundDetails: ParticipantRoundDetailDTO[] = [];

  const configuredRounds = comp?.rounds ?? [{ round: 1 as RoundIdentifier, status: "active" as const, startedAt: null, closedAt: null }];

  for (const compRound of configuredRounds) {
    const rId = compRound.round as RoundIdentifier;
    const rawEvals = evalsByRound.get(rId) ?? [];

    const roundResult = aggregateParticipantRoundScores(
      rId,
      rawEvals,
      panelJudgeCount,
      comp?.scoringPolicy,
    );
    // Only rounds backed by submitted evaluations contribute to the overall score.
    // Pending rounds must not be treated as zero-scored components.
    if (rawEvals.length > 0) {
      roundResults[rId] = roundResult;
    }

    const critMap = criteriaByRound.get(rId);
    const criteriaScores: CriterionBreakdownDTO[] = [];

    if (critMap) {
      critMap.forEach((val, paramId) => {
        const avgAwarded = val.evalCount > 0 ? Number((val.totalAwarded / val.evalCount).toFixed(2)) : 0;
        const percentage = val.maxMarks > 0 ? Number(((avgAwarded / val.maxMarks) * 100).toFixed(2)) : 0;
        criteriaScores.push({
          parameterId: paramId,
          parameterName: val.parameterName,
          awardedMarks: avgAwarded,
          maxMarks: val.maxMarks,
          weightage: val.weightage,
          percentage,
        });
      });
    }

    let status: ParticipantRoundDetailDTO["status"] = "pending";
    if (roundResult.isComplete) {
      status = "evaluated";
    } else if (rawEvals.length > 0) {
      status = "in_progress";
    }

    roundDetails.push({
      round: rId,
      roundScore: roundResult.roundScore,
      rawAverageMarks: roundResult.rawAverageMarks,
      maxPossibleMarks: roundResult.maxPossibleMarks,
      judgeCount: roundResult.judgeCount,
      panelJudgeCount: roundResult.panelJudgeCount,
      isComplete: roundResult.isComplete,
      status,
      criteriaScores,
    });
  }

  const overall = calculateParticipantOverallScore(roundResults);

  // Determine overall max possible score dynamically
  let maxPossibleScore = 0;
  if (comp?.scoringPolicy?.totalSource === "fixed" && comp.scoringPolicy.fixedTotal) {
    maxPossibleScore = comp.scoringPolicy.fixedTotal;
  } else {
    // Sum max possible marks of rounds evaluated
    maxPossibleScore = roundDetails.reduce((acc, r) => acc + r.maxPossibleMarks, 0);
    if (maxPossibleScore === 0) {
      // Default to 100 if no rounds have defined criteria yet
      maxPossibleScore = 100;
    }
  }

  let evaluationStatus: ParticipantResultsDTO["evaluationStatus"] = "pending";
  const anyCompleted = roundDetails.some((r) => r.isComplete);
  const anyStarted = roundDetails.some((r) => r.judgeCount > 0);

  if (roundDetails.length > 0 && roundDetails.every((r) => r.isComplete)) {
    evaluationStatus = "completed";
  } else if (anyStarted || anyCompleted) {
    evaluationStatus = "in_progress";
  }

  return {
    competition: {
      id: comp?._id?.toString() ?? "",
      name: comp?.name ?? "Competition",
      status: comp?.status ?? "active",
      scoringPolicy: {
        totalSource: comp?.scoringPolicy?.totalSource ?? "derived",
        fixedTotal: comp?.scoringPolicy?.fixedTotal ?? null,
      },
    },
    evaluationStatus,
    rounds: roundDetails,
    overallScore: overall.totalScore,
    rawTotalMarks: overall.rawTotalMarks,
    maxPossibleScore,
  };
}

export async function updateParticipantTeam(
  userId: string,
  userEmail: string,
  data: { name?: string | undefined; teamMembers?: string[] | undefined },
): Promise<ParticipantProfileDTO> {
  const participant = await findParticipantForUser(userId, userEmail);

  if (typeof data.name === "string" && data.name.trim().length > 0) {
    participant.name = data.name.trim();
  }

  if (Array.isArray(data.teamMembers)) {
    participant.teamMembers = data.teamMembers
      .map((m) => (typeof m === "string" ? m.trim() : ""))
      .filter((m) => m.length > 0);
  }

  await participant.save();

  return getParticipantProfile(userId, userEmail);
}

export async function getPublicCompetitions(): Promise<
  Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    roundsCount: number;
  }>
> {
  const competitions = await Competition.find({
    status: { $ne: "archived" },
  })
    .sort({ createdAt: -1 })
    .select("_id name description status rounds");

  return competitions.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    description: c.description ?? null,
    status: c.status,
    roundsCount: c.rounds?.length ?? 1,
  }));
}
