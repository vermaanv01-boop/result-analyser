import type { NextFunction, Response } from "express";
import type { ValidatedRequest } from "../middleware/validate";
import {
  createCompetition,
  getCompetitionById,
  listCompetitions,
  updateCompetition,
  updateRoundStatus,
} from "../services/competition.service";
import type { RoundIdentifier } from "../types/domain.types";
import type {
  competitionIdParamsSchema,
  createCompetitionSchema,
  roundParamsSchema,
  updateCompetitionSchema,
  updateRoundStatusSchema,
} from "../validators/competition.validators";

export async function createCompetitionHandler(
  req: ValidatedRequest<{ body: typeof createCompetitionSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const competition = await createCompetition(req.user!, req.body);
    res.status(201).json({ competition });
  } catch (error) {
    next(error);
  }
}

export async function listCompetitionsHandler(
  _req: ValidatedRequest<{}>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const competitions = await listCompetitions();
    res.status(200).json({ competitions });
  } catch (error) {
    next(error);
  }
}

export async function getCompetitionHandler(
  req: ValidatedRequest<{ params: typeof competitionIdParamsSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const competition = await getCompetitionById(req.params.competitionId);
    res.status(200).json({ competition });
  } catch (error) {
    next(error);
  }
}

export async function updateCompetitionHandler(
  req: ValidatedRequest<{
    params: typeof competitionIdParamsSchema;
    body: typeof updateCompetitionSchema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const competition = await updateCompetition(
      req.params.competitionId,
      req.body,
    );
    res.status(200).json({ competition });
  } catch (error) {
    next(error);
  }
}

export async function updateRoundStatusHandler(
  req: ValidatedRequest<{
    params: typeof roundParamsSchema;
    body: typeof updateRoundStatusSchema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const roundNumber = (req.params.round === "1" ? 1 : 2) as RoundIdentifier;
    const rounds = await updateRoundStatus(
      req.params.competitionId,
      roundNumber,
      req.body.status,
    );
    res.status(200).json({ rounds });
  } catch (error) {
    next(error);
  }
}
