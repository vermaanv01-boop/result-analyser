import {
  Competition,
  type CompetitionDocument,
  type CompetitionRound,
  type CompetitionScoringPolicy,
  type CompetitionStatus,
  type RoundStatus,
} from "../models/competition.model";
import type { AuthenticatedUser } from "../types/auth.types";
import type { RoundIdentifier } from "../types/domain.types";
import { ApiError } from "../utils/api-error";

export async function createCompetition(
  creator: AuthenticatedUser,
  data: {
    name: string;
    description?: string | null;
    scoringPolicy?: CompetitionScoringPolicy;
  },
): Promise<CompetitionDocument> {
  const competition = new Competition({
    name: data.name.trim(),
    description: data.description?.trim() ?? null,
    createdBy: creator.id,
    ...(data.scoringPolicy ? { scoringPolicy: data.scoringPolicy } : {}),
  });

  await competition.save();
  return competition;
}

export async function getCompetitionById(
  id: string,
): Promise<CompetitionDocument> {
  const competition = await Competition.findById(id).populate("createdBy", "name email");
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }
  return competition;
}

export async function listCompetitions(): Promise<CompetitionDocument[]> {
  return Competition.find().sort({ createdAt: -1 });
}

export async function updateCompetition(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    status?: CompetitionStatus;
    scoringPolicy?: CompetitionScoringPolicy;
  },
): Promise<CompetitionDocument> {
  const competition = await Competition.findById(id);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  if (data.name !== undefined) {
    competition.name = data.name.trim();
  }
  if (data.description !== undefined) {
    competition.description = data.description ? data.description.trim() : null;
  }
  if (data.status !== undefined) {
    competition.status = data.status;
  }
  if (data.scoringPolicy !== undefined) {
    competition.scoringPolicy = data.scoringPolicy;
  }

  await competition.save();
  return competition;
}

export async function updateRoundStatus(
  competitionId: string,
  roundNum: RoundIdentifier,
  newStatus: RoundStatus,
): Promise<CompetitionRound[]> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  const rounds = competition.rounds;
  const target = rounds.find((r) => r.round === roundNum);
  if (!target) {
    throw ApiError.notFound(`Round ${roundNum} not found on competition`);
  }

  const round1 = rounds.find((r) => r.round === 1)!;
  const round2 = rounds.find((r) => r.round === 2)!;

  // Validation rules for round lifecycle transitions:
  if (roundNum === 1) {
    if (newStatus === "active") {
      target.status = "active";
      target.startedAt = target.startedAt ?? new Date();
      if (competition.status === "draft") {
        competition.status = "active";
      }
    } else if (newStatus === "closed") {
      target.status = "closed";
      target.closedAt = new Date();
      if (!target.startedAt) {
        target.startedAt = target.closedAt;
      }
    } else if (newStatus === "pending") {
      if (round2.status !== "pending") {
        throw ApiError.badRequest(
          "Cannot set Round 1 to pending while Round 2 is active or closed",
        );
      }
      target.status = "pending";
      target.startedAt = null;
      target.closedAt = null;
    }
  } else if (roundNum === 2) {
    if (newStatus === "active") {
      if (round1.status !== "closed") {
        throw ApiError.badRequest(
          "Round 1 must be closed before Round 2 can be activated",
        );
      }
      target.status = "active";
      target.startedAt = target.startedAt ?? new Date();
    } else if (newStatus === "closed") {
      if (round1.status !== "closed") {
        throw ApiError.badRequest(
          "Round 1 must be closed before Round 2 can be closed",
        );
      }
      target.status = "closed";
      target.closedAt = new Date();
      if (!target.startedAt) {
        target.startedAt = target.closedAt;
      }
    } else if (newStatus === "pending") {
      target.status = "pending";
      target.startedAt = null;
      target.closedAt = null;
    }
  }

  competition.markModified("rounds");
  await competition.save();
  return competition.rounds;
}
