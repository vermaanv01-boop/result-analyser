import type { NextFunction, Response } from "express";
import type { ValidatedRequest } from "../middleware/validate";
import { getLeaderboard } from "../services/leaderboard.service";
import type {
  competitionIdParamsSchema,
  roundParamsSchema,
} from "../validators/competition.validators";
import type { panelParamsSchema } from "../validators/panel.validators";

export async function getOverallLeaderboardHandler(
  req: ValidatedRequest<{ params: typeof competitionIdParamsSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getLeaderboard(req.params.competitionId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getRoundLeaderboardHandler(
  req: ValidatedRequest<{ params: typeof roundParamsSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getLeaderboard(req.params.competitionId, {
      round: req.params.round,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getPanelLeaderboardHandler(
  req: ValidatedRequest<{ params: typeof panelParamsSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getLeaderboard(req.params.competitionId, {
      panelId: req.params.panelId,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
