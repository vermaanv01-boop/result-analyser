import { Types } from "mongoose";
import { Competition } from "../models/competition.model";
import { EvaluationParameter } from "../models/evaluation-parameter.model";
import {
  Evaluation,
  type EvaluationCriterion,
  type EvaluationDocument,
} from "../models/evaluation.model";
import { Panel } from "../models/panel.model";
import { Participant } from "../models/participant.model";
import type { RoundIdentifier } from "../types/domain.types";
import { ApiError } from "../utils/api-error";

export interface CriterionInputScore {
  parameter: string;
  awardedMarks: number;
}

export interface SaveEvaluationOptions {
  competition: string;
  participant: string;
  panel: string;
  round: RoundIdentifier;
  scores: CriterionInputScore[];
  isSubmit: boolean;
}

export async function saveEvaluation(
  judgeId: string,
  data: SaveEvaluationOptions,
): Promise<EvaluationDocument> {
  const competition = await Competition.findById(data.competition);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  if (competition.status !== "active") {
    throw ApiError.badRequest(
      `Cannot evaluate participants in a competition with status '${competition.status}'`,
    );
  }

  const currentRound = competition.rounds.find((r) => r.round === data.round);
  if (!currentRound) {
    throw ApiError.badRequest(`Round ${data.round} is not defined in this competition`);
  }

  if (currentRound.status !== "active") {
    throw ApiError.badRequest(
      `Round ${data.round} is currently ${currentRound.status}. Evaluations can only be submitted for active rounds`,
    );
  }

  const panel = await Panel.findOne({
    _id: data.panel,
    competition: competition._id,
  });

  if (!panel) {
    throw ApiError.badRequest("Panel not found for this competition");
  }

  const isJudgeAssigned = panel.judges.some((j) => j.toString() === judgeId);
  if (!isJudgeAssigned) {
    throw ApiError.forbidden("Judge is not assigned to this panel");
  }

  const participant = await Participant.findOne({
    _id: data.participant,
    competition: competition._id,
  });

  if (!participant) {
    throw ApiError.notFound("Participant not found for this competition");
  }

  if (!participant.isActive) {
    throw ApiError.badRequest("Participant is not active");
  }

  if (!participant.panel || !participant.panel.equals(panel._id)) {
    throw ApiError.badRequest(
      "Participant is not assigned to the specified panel",
    );
  }

  const eligibilityEntry = participant.eligibility.find(
    (e) => e.round === data.round,
  );
  if (!eligibilityEntry || !eligibilityEntry.eligible) {
    throw ApiError.badRequest(
      `Participant is not eligible for Round ${data.round}${
        eligibilityEntry?.ineligibleReason
          ? `: ${eligibilityEntry.ineligibleReason}`
          : ""
      }`,
    );
  }

  // Check if evaluation already exists
  const existingEval = await Evaluation.findOne({
    competition: competition._id,
    participant: participant._id,
    round: data.round,
    judge: new Types.ObjectId(judgeId),
  });

  if (existingEval && existingEval.status === "submitted") {
    throw ApiError.conflict(
      "Evaluation has already been submitted and cannot be modified",
    );
  }

  // Active parameters for this round
  const activeParams = await EvaluationParameter.find({
    competition: competition._id,
    applicableRounds: data.round,
    isActive: true,
  });

  if (activeParams.length === 0) {
    throw ApiError.badRequest(
      `No active evaluation parameters configured for Round ${data.round}`,
    );
  }

  const activeParamsMap = new Map<string, (typeof activeParams)[0]>();
  activeParams.forEach((p) => {
    activeParamsMap.set(p._id.toString(), p);
  });

  const scoredParams = new Set<string>();
  const criteriaSnapshot: EvaluationCriterion[] = [];

  for (const score of data.scores) {
    const param = activeParamsMap.get(score.parameter);
    if (!param) {
      throw ApiError.badRequest(
        `Parameter '${score.parameter}' is not active or does not apply to Round ${data.round}`,
      );
    }

    if (scoredParams.has(score.parameter)) {
      throw ApiError.badRequest(
        `Duplicate score submitted for parameter '${param.name}'`,
      );
    }
    scoredParams.add(score.parameter);

    if (score.awardedMarks > param.maxMarks) {
      throw ApiError.badRequest(
        `Awarded marks (${score.awardedMarks}) exceed maximum marks (${param.maxMarks}) for parameter '${param.name}'`,
      );
    }

    if (score.awardedMarks < 0) {
      throw ApiError.badRequest(
        `Awarded marks cannot be negative for parameter '${param.name}'`,
      );
    }

    criteriaSnapshot.push({
      parameter: param._id,
      configVersion: param.configVersion,
      parameterName: param.name,
      maxMarks: param.maxMarks,
      weightage: param.weightage,
      applicableRounds: param.applicableRounds,
      awardedMarks: score.awardedMarks,
    });
  }

  if (data.isSubmit) {
    // For final submission, all active criteria for the round must be scored
    for (const [id, param] of activeParamsMap.entries()) {
      if (!scoredParams.has(id)) {
        throw ApiError.badRequest(
          `Criterion '${param.name}' is missing a score. All active parameters must be evaluated upon submission`,
        );
      }
    }
  }

  if (existingEval) {
    existingEval.criteria = criteriaSnapshot;
    existingEval.parameterConfigVersion = competition.parameterConfigVersion;
    existingEval.panel = panel._id;
    if (data.isSubmit) {
      existingEval.status = "submitted";
      existingEval.submittedAt = new Date();
    }
    await existingEval.save();
    return existingEval;
  }

  const evaluation = new Evaluation({
    competition: competition._id,
    participant: participant._id,
    panel: panel._id,
    judge: new Types.ObjectId(judgeId),
    round: data.round,
    status: data.isSubmit ? "submitted" : "draft",
    criteria: criteriaSnapshot,
    parameterConfigVersion: competition.parameterConfigVersion,
    submittedAt: data.isSubmit ? new Date() : null,
  });

  await evaluation.save();
  return evaluation;
}

export async function getEvaluations(filters: {
  competition?: string;
  panel?: string;
  participant?: string;
  judge?: string;
  round?: RoundIdentifier;
  status?: "draft" | "submitted";
}): Promise<EvaluationDocument[]> {
  const query: Record<string, unknown> = {};

  if (filters.competition) query["competition"] = filters.competition;
  if (filters.panel) query["panel"] = filters.panel;
  if (filters.participant) query["participant"] = filters.participant;
  if (filters.judge) query["judge"] = filters.judge;
  if (filters.round) query["round"] = filters.round;
  if (filters.status) query["status"] = filters.status;

  return Evaluation.find(query)
    .populate("participant", "name registrationId")
    .populate("judge", "name email")
    .populate("panel", "name")
    .sort({ updatedAt: -1 });
}

export async function getEvaluationById(id: string): Promise<EvaluationDocument> {
  const evalDoc = await Evaluation.findById(id)
    .populate("participant", "name registrationId")
    .populate("judge", "name email")
    .populate("panel", "name");

  if (!evalDoc) {
    throw ApiError.notFound("Evaluation not found");
  }

  return evalDoc;
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

export async function getProgressReport(
  competitionId: string,
): Promise<ProgressReport> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  const panels = await Panel.find({ competition: competition._id });
  const participants = await Participant.find({
    competition: competition._id,
    isActive: true,
  });
  const submittedEvals = await Evaluation.find({
    competition: competition._id,
    status: "submitted",
  });

  const activeRoundEntry = competition.rounds.find((r) => r.status === "active");

  const panelProgress = panels.map((panel) => {
    const panelParticipants = participants.filter(
      (p) => p.panel && p.panel.equals(panel._id),
    );
    const judgeCount = panel.judges.length;
    const participantCount = panelParticipants.length;

    const round1EligibleCount = panelParticipants.filter(
      (p) => p.eligibility.find((e) => e.round === 1)?.eligible,
    ).length;
    const round2EligibleCount = panelParticipants.filter(
      (p) => p.eligibility.find((e) => e.round === 2)?.eligible,
    ).length;

    const round1Expected = round1EligibleCount * judgeCount;
    const round2Expected = round2EligibleCount * judgeCount;

    const round1Submitted = submittedEvals.filter(
      (e) => e.panel.equals(panel._id) && e.round === 1,
    ).length;
    const round2Submitted = submittedEvals.filter(
      (e) => e.panel.equals(panel._id) && e.round === 2,
    ).length;

    return {
      panelId: panel._id.toString(),
      panelName: panel.name,
      judgeCount,
      participantCount,
      round1: {
        expected: round1Expected,
        submitted: round1Submitted,
        isComplete: round1Expected > 0 && round1Submitted >= round1Expected,
      },
      round2: {
        expected: round2Expected,
        submitted: round2Submitted,
        isComplete: round2Expected > 0 && round2Submitted >= round2Expected,
      },
    };
  });

  return {
    competitionId: competition._id.toString(),
    totalParticipants: participants.length,
    totalPanels: panels.length,
    activeRound: activeRoundEntry ? activeRoundEntry.round : null,
    panelProgress,
  };
}
