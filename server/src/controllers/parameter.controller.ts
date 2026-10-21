import type { NextFunction, Response } from "express";
import type { ValidatedRequest } from "../middleware/validate";
import {
  createParameter,
  getParameterById,
  getParameters,
  updateParameter,
} from "../services/parameter.service";
import type { competitionIdParamsSchema } from "../validators/competition.validators";
import type {
  createParameterSchema,
  parameterParamsSchema,
  parameterQuerySchema,
  updateParameterSchema,
} from "../validators/parameter.validators";

export async function createParameterHandler(
  req: ValidatedRequest<{
    params: typeof competitionIdParamsSchema;
    body: typeof createParameterSchema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parameter = await createParameter(
      req.params.competitionId,
      req.body,
    );
    res.status(201).json({ parameter });
  } catch (error) {
    next(error);
  }
}

export async function listParametersHandler(
  req: ValidatedRequest<{
    params: typeof competitionIdParamsSchema;
    query: typeof parameterQuerySchema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parameters = await getParameters(
      req.params.competitionId,
      req.query,
    );
    res.status(200).json({ parameters });
  } catch (error) {
    next(error);
  }
}

export async function getParameterHandler(
  req: ValidatedRequest<{ params: typeof parameterParamsSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parameter = await getParameterById(
      req.params.competitionId,
      req.params.parameterId,
    );
    res.status(200).json({ parameter });
  } catch (error) {
    next(error);
  }
}

export async function updateParameterHandler(
  req: ValidatedRequest<{
    params: typeof parameterParamsSchema;
    body: typeof updateParameterSchema;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parameter = await updateParameter(
      req.params.competitionId,
      req.params.parameterId,
      req.body,
    );
    res.status(200).json({ parameter });
  } catch (error) {
    next(error);
  }
}
