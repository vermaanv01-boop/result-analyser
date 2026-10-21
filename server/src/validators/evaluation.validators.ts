import { z } from "zod";
import { EVALUATION_STATUSES } from "../models/evaluation.model";
import {
  nonNegativeNumberSchema,
  objectIdSchema,
  roundIdentifierSchema,
} from "./common";

export const criterionScoreSchema = z.object({
  parameter: objectIdSchema,
  awardedMarks: nonNegativeNumberSchema,
});

export const saveEvaluationSchema = z.object({
  competition: objectIdSchema,
  participant: objectIdSchema,
  panel: objectIdSchema,
  round: roundIdentifierSchema,
  scores: z
    .array(criterionScoreSchema)
    .min(1, "scores must contain at least one criterion"),
});

export const evaluationQuerySchema = z.object({
  competition: objectIdSchema.optional(),
  panel: objectIdSchema.optional(),
  participant: objectIdSchema.optional(),
  judge: objectIdSchema.optional(),
  round: z.coerce.number().pipe(roundIdentifierSchema).optional(),
  status: z.enum(EVALUATION_STATUSES).optional(),
});
