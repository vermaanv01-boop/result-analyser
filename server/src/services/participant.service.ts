import { Types } from "mongoose";
import { Competition } from "../models/competition.model";
import { Evaluation } from "../models/evaluation.model";
import { Panel } from "../models/panel.model";
import {
  Participant,
  type ParticipantDocument,
} from "../models/participant.model";
import type { RoundIdentifier } from "../types/domain.types";
import { ApiError } from "../utils/api-error";
import { generateUniqueRegistrationId } from "../utils/registration-id";
import {
  aggregateParticipantRoundScores,
  rankLeaderboardEntries,
  type RawJudgeEvaluation,
} from "./scoring.service";

export async function createParticipant(
  competitionId: string,
  data: {
    name: string;
    registrationId?: string | null | undefined;
    email?: string | null | undefined;
    panel?: string | null | undefined;
  },
): Promise<ParticipantDocument> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  let normalizedRegId: string;
  if (data.registrationId && data.registrationId.trim()) {
    normalizedRegId = data.registrationId.trim().toUpperCase();
    const existing = await Participant.findOne({
      competition: competition._id,
      registrationId: normalizedRegId,
    });

    if (existing) {
      throw ApiError.conflict(
        `Participant with registration ID '${normalizedRegId}' already exists in this competition`,
      );
    }
  } else {
    normalizedRegId = await generateUniqueRegistrationId(competition._id, "REG");
  }

  let panelObjectId: Types.ObjectId | null = null;
  if (data.panel) {
    const panel = await Panel.findOne({
      _id: data.panel,
      competition: competition._id,
    });
    if (!panel) {
      throw ApiError.badRequest("Panel not found for this competition");
    }
    if (!panel.isActive) {
      throw ApiError.badRequest(
        "Inactive panels cannot receive new participant assignments",
      );
    }
    panelObjectId = panel._id;
  }

  const participant = new Participant({
    competition: competition._id,
    name: data.name.trim(),
    registrationId: normalizedRegId,
    email: data.email ? data.email.trim().toLowerCase() : null,
    panel: panelObjectId,
    isActive: true,
  });

  await participant.save();
  return participant;
}

export async function getParticipants(
  competitionId: string,
  filters: {
    panel?: string | undefined;
    isActive?: boolean | undefined;
    round?: RoundIdentifier | undefined;
  },
): Promise<ParticipantDocument[]> {
  const query: Record<string, unknown> = { competition: competitionId };

  if (filters.panel !== undefined) {
    query["panel"] = filters.panel ? new Types.ObjectId(filters.panel) : null;
  }

  if (filters.isActive !== undefined) {
    query["isActive"] = filters.isActive;
  }

  if (filters.round !== undefined) {
    query["eligibility"] = {
      $elemMatch: { round: filters.round, eligible: true },
    };
  }

  return Participant.find(query)
    .populate("panel", "name isActive")
    .sort({ registrationId: 1 });
}

export async function getParticipantById(
  competitionId: string,
  participantId: string,
): Promise<ParticipantDocument> {
  const participant = await Participant.findOne({
    _id: participantId,
    competition: competitionId,
  }).populate("panel", "name isActive judges");

  if (!participant) {
    throw ApiError.notFound("Participant not found for this competition");
  }

  return participant;
}

export async function updateParticipant(
  competitionId: string,
  participantId: string,
  data: {
    name?: string | undefined;
    registrationId?: string | undefined;
    email?: string | null | undefined;
    panel?: string | null | undefined;
    isActive?: boolean | undefined;
  },
): Promise<ParticipantDocument> {
  const participant = await Participant.findOne({
    _id: participantId,
    competition: competitionId,
  });

  if (!participant) {
    throw ApiError.notFound("Participant not found for this competition");
  }

  if (data.name !== undefined) {
    participant.name = data.name.trim();
  }

  if (data.registrationId !== undefined) {
    const normalizedReg = data.registrationId.trim().toUpperCase();
    if (normalizedReg !== participant.registrationId) {
      const duplicate = await Participant.findOne({
        competition: competitionId,
        registrationId: normalizedReg,
        _id: { $ne: participant._id },
      });
      if (duplicate) {
        throw ApiError.conflict(
          `Registration ID '${normalizedReg}' is already taken in this competition`,
        );
      }
      participant.registrationId = normalizedReg;
    }
  }

  if (data.email !== undefined) {
    participant.email = data.email ? data.email.trim().toLowerCase() : null;
  }

  if (data.isActive !== undefined) {
    participant.isActive = data.isActive;
  }

  if (data.panel !== undefined) {
    if (data.panel === null) {
      participant.panel = null;
    } else {
      const panel = await Panel.findOne({
        _id: data.panel,
        competition: competitionId,
      });
      if (!panel) {
        throw ApiError.badRequest("Panel not found for this competition");
      }
      if (!panel.isActive) {
        throw ApiError.badRequest(
          "Inactive panels cannot receive new participant assignments",
        );
      }
      participant.panel = panel._id;
    }
  }

  await participant.save();
  return participant;
}

export async function updateEligibility(
  competitionId: string,
  participantId: string,
  round: RoundIdentifier,
  eligible: boolean,
  ineligibleReason?: string | null,
): Promise<ParticipantDocument> {
  const participant = await Participant.findOne({
    _id: participantId,
    competition: competitionId,
  });

  if (!participant) {
    throw ApiError.notFound("Participant not found for this competition");
  }

  const entry = participant.eligibility.find((e) => e.round === round);
  if (!entry) {
    throw ApiError.notFound(`Eligibility for round ${round} not found`);
  }

  entry.eligible = eligible;
  entry.ineligibleReason = eligible ? null : ineligibleReason ?? "Ineligible";
  entry.updatedAt = new Date();

  participant.markModified("eligibility");
  await participant.save();
  return participant;
}

export interface QualifyRound2Options {
  method: "explicit" | "topN" | "cutoffScore";
  participantIds?: string[] | undefined;
  topN?: number | undefined;
  cutoffScore?: number | undefined;
}

export async function qualifyParticipantsForRound2(
  competitionId: string,
  options: QualifyRound2Options,
): Promise<{ qualifiedCount: number; totalProcessed: number }> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  const participants = await Participant.find({
    competition: competition._id,
    isActive: true,
  });

  let qualifiedIds = new Set<string>();

  if (options.method === "explicit") {
    if (!options.participantIds || options.participantIds.length === 0) {
      throw ApiError.badRequest("participantIds must be provided for explicit qualification");
    }
    qualifiedIds = new Set(options.participantIds);
  } else {
    // Determine qualifiers from Round 1 scores
    const panels = await Panel.find({ competition: competition._id });
    const panelJudgeCounts = new Map<string, number>();
    panels.forEach((p) => {
      panelJudgeCounts.set(p._id.toString(), p.judges.length);
    });

    const evaluations = await Evaluation.find({
      competition: competition._id,
      round: 1,
      status: "submitted",
    });

    const evalsByParticipant = new Map<string, RawJudgeEvaluation[]>();
    evaluations.forEach((e) => {
      const pId = e.participant.toString();
      const list = evalsByParticipant.get(pId) ?? [];
      list.push({
        judgeId: e.judge.toString(),
        criteria: e.criteria,
      });
      evalsByParticipant.set(pId, list);
    });

    const entries = participants.map((p) => {
      const pId = p._id.toString();
      const pPanelId = p.panel ? p.panel.toString() : "";
      const judgeCount = panelJudgeCounts.get(pPanelId) ?? 0;
      const rawEvals = evalsByParticipant.get(pId) ?? [];
      const round1Result = aggregateParticipantRoundScores(
        1,
        rawEvals,
        judgeCount,
        competition.scoringPolicy,
      );

      return {
        participantId: pId,
        registrationId: p.registrationId,
        participantName: p.name,
        panelId: pPanelId,
        panelName: null,
        isEligible: true,
        totalScore: round1Result.roundScore,
        rawTotalMarks: round1Result.rawAverageMarks,
        roundResults: { 1: round1Result },
      };
    });

    const ranked = rankLeaderboardEntries(entries);

    if (options.method === "topN") {
      const topN = options.topN ?? 10;
      for (const item of ranked) {
        if (item.rank <= topN && item.totalScore > 0) {
          qualifiedIds.add(item.participantId);
        }
      }
    } else if (options.method === "cutoffScore") {
      const cutoff = options.cutoffScore ?? 50;
      for (const item of ranked) {
        if (item.totalScore >= cutoff) {
          qualifiedIds.add(item.participantId);
        }
      }
    }
  }

  // Update participants' Round 2 eligibility in database
  for (const participant of participants) {
    const pId = participant._id.toString();
    const isQualifying = qualifiedIds.has(pId);
    const r2 = participant.eligibility.find((e) => e.round === 2);
    if (r2) {
      r2.eligible = isQualifying;
      r2.ineligibleReason = isQualifying
        ? null
        : "Did not qualify for Round 2";
      r2.updatedAt = new Date();
      participant.markModified("eligibility");
      await participant.save();
    }
  }

  return {
    qualifiedCount: qualifiedIds.size,
    totalProcessed: participants.length,
  };
}
