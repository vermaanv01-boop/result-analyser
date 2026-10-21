import type { NextFunction, Response } from "express";
import type { ValidatedRequest } from "../middleware/validate";
import {
  createParticipant,
  getParticipantById,
  getParticipants,
  qualifyParticipantsForRound2,
  updateEligibility,
  updateParticipant,
} from "../services/participant.service";
import type { competitionIdParamsSchema } from "../validators/competition.validators";
import type {
  createParticipantSchema,
  participantParamsSchema,
  participantQuerySchema,
  qualifyRound2Schema,
  updateEligibilitySchema,
  updateParticipantSchema,
} from "../validators/participant.validators";

export async function createParticipantHandler(
  req: ValidatedRequest<{
    params: typeof competitionIdParamsSchema;
    body: typeof createParticipantSchema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const participant = await createParticipant(
      req.params.competitionId,
      req.body,
    );
    res.status(201).json({ participant });
  } catch (error) {
    next(error);
  }
}

export async function listParticipantsHandler(
  req: ValidatedRequest<{
    params: typeof competitionIdParamsSchema;
    query: typeof participantQuerySchema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const participants = await getParticipants(
      req.params.competitionId,
      req.query,
    );
    res.status(200).json({ participants });
  } catch (error) {
    next(error);
  }
}

export async function getParticipantHandler(
  req: ValidatedRequest<{ params: typeof participantParamsSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const participant = await getParticipantById(
      req.params.competitionId,
      req.params.participantId,
    );
    res.status(200).json({ participant });
  } catch (error) {
    next(error);
  }
}

export async function updateParticipantHandler(
  req: ValidatedRequest<{
    params: typeof participantParamsSchema;
    body: typeof updateParticipantSchema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const participant = await updateParticipant(
      req.params.competitionId,
      req.params.participantId,
      req.body,
    );
    res.status(200).json({ participant });
  } catch (error) {
    next(error);
  }
}

export async function updateEligibilityHandler(
  req: ValidatedRequest<{
    params: typeof participantParamsSchema;
    body: typeof updateEligibilitySchema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const participant = await updateEligibility(
      req.params.competitionId,
      req.params.participantId,
      req.body.round,
      req.body.eligible,
      req.body.ineligibleReason,
    );
    res.status(200).json({ participant });
  } catch (error) {
    next(error);
  }
}

export async function qualifyRound2Handler(
  req: ValidatedRequest<{
    params: typeof competitionIdParamsSchema;
    body: typeof qualifyRound2Schema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await qualifyParticipantsForRound2(
      req.params.competitionId,
      req.body,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
