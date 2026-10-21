import type { NextFunction, Response } from "express";
import type { ValidatedRequest } from "../middleware/validate";
import {
  createPanel,
  getPanelById,
  getPanels,
  updatePanel,
} from "../services/panel.service";
import type { competitionIdParamsSchema } from "../validators/competition.validators";
import type {
  createPanelSchema,
  panelParamsSchema,
  updatePanelSchema,
} from "../validators/panel.validators";

export async function createPanelHandler(
  req: ValidatedRequest<{
    params: typeof competitionIdParamsSchema;
    body: typeof createPanelSchema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const panel = await createPanel(req.params.competitionId, req.body);
    res.status(201).json({ panel });
  } catch (error) {
    next(error);
  }
}

export async function listPanelsHandler(
  req: ValidatedRequest<{ params: typeof competitionIdParamsSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const panels = await getPanels(req.params.competitionId);
    res.status(200).json({ panels });
  } catch (error) {
    next(error);
  }
}

export async function getPanelHandler(
  req: ValidatedRequest<{ params: typeof panelParamsSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const panel = await getPanelById(
      req.params.competitionId,
      req.params.panelId,
    );
    res.status(200).json({ panel });
  } catch (error) {
    next(error);
  }
}

export async function updatePanelHandler(
  req: ValidatedRequest<{
    params: typeof panelParamsSchema;
    body: typeof updatePanelSchema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const panel = await updatePanel(
      req.params.competitionId,
      req.params.panelId,
      req.body,
    );
    res.status(200).json({ panel });
  } catch (error) {
    next(error);
  }
}
