import type { NextFunction, Response } from "express";
import type { ValidatedRequest } from "../middleware/validate";
import {
  getParticipantProfile,
  getParticipantResults,
  getPublicCompetitions,
  updateParticipantTeam,
} from "../services/portal.service";
import type { updateTeamSchema } from "../validators/portal.validators";

export async function getParticipantProfileHandler(
  req: ValidatedRequest<{}>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await getParticipantProfile(req.user!.id, req.user!.email);
    res.status(200).json({ participant: profile });
  } catch (error) {
    next(error);
  }
}

export async function getParticipantResultsHandler(
  req: ValidatedRequest<{}>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const results = await getParticipantResults(req.user!.id, req.user!.email);
    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
}

export async function updateParticipantTeamHandler(
  req: ValidatedRequest<{ body: typeof updateTeamSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const updated = await updateParticipantTeam(
      req.user!.id,
      req.user!.email,
      req.body,
    );
    res.status(200).json({ participant: updated });
  } catch (error) {
    next(error);
  }
}

export async function getPublicCompetitionsHandler(
  _req: ValidatedRequest<{}>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const competitions = await getPublicCompetitions();
    res.status(200).json({ competitions });
  } catch (error) {
    next(error);
  }
}
