import type { NextFunction, Response } from "express";
import type { ValidatedRequest } from "../middleware/validate";
import {
  getEvaluationById,
  getEvaluations,
  getProgressReport,
  saveEvaluation,
} from "../services/evaluation.service";
import { idParamsSchema } from "../validators/common";
import type { competitionIdParamsSchema } from "../validators/competition.validators";
import type {
  evaluationQuerySchema,
  saveEvaluationSchema,
} from "../validators/evaluation.validators";

export async function saveDraftHandler(
  req: ValidatedRequest<{ body: typeof saveEvaluationSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const evaluation = await saveEvaluation(req.user!.id, {
      ...req.body,
      isSubmit: false,
    });
    res.status(200).json({ evaluation });
  } catch (error) {
    next(error);
  }
}

export async function submitEvaluationHandler(
  req: ValidatedRequest<{ body: typeof saveEvaluationSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const evaluation = await saveEvaluation(req.user!.id, {
      ...req.body,
      isSubmit: true,
    });
    res.status(201).json({ evaluation });
  } catch (error) {
    next(error);
  }
}

export async function getEvaluationHandler(
  req: ValidatedRequest<{ params: typeof idParamsSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const evaluation = await getEvaluationById(req.params.id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    res.status(200).json({ evaluation });
  } catch (error) {
    next(error);
  }
}

export async function listEvaluationsHandler(
  req: ValidatedRequest<{ query: typeof evaluationQuerySchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const evaluations = await getEvaluations(req.query);
    res.status(200).json({ evaluations });
  } catch (error) {
    next(error);
  }
}

export async function getProgressReportHandler(
  req: ValidatedRequest<{ params: typeof competitionIdParamsSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const progress = await getProgressReport(req.params.competitionId);
    res.status(200).json({ progress });
  } catch (error) {
    next(error);
  }
}
