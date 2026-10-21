import { z } from "zod";
import {
  COMPETITION_STATUSES,
  ROUND_STATUSES,
  SCORING_TOTAL_SOURCES,
} from "../models/competition.model";
import {
  nonEmptyString,
  objectIdSchema,
  positiveNumberSchema,
  roundIdentifierSchema,
} from "./common";

const scoringStrategySchema = z.object({
  method: z.string().trim().max(100).nullable().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

const scoringPolicySchema = z.object({
  totalSource: z.enum(SCORING_TOTAL_SOURCES).optional(),
  fixedTotal: positiveNumberSchema.nullable().optional(),
  normalization: scoringStrategySchema.optional(),
  aggregation: scoringStrategySchema.optional(),
  weightage: scoringStrategySchema.optional(),
});

export const createCompetitionSchema = z.object({
  name: nonEmptyString(200, "name is required"),
  description: z.string().trim().max(2000).nullable().optional(),
  scoringPolicy: scoringPolicySchema.optional(),
});

export const updateCompetitionSchema = z.object({
  name: nonEmptyString(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(COMPETITION_STATUSES).optional(),
  scoringPolicy: scoringPolicySchema.optional(),
});

export const competitionIdParamsSchema = z.object({
  competitionId: objectIdSchema,
});

export const roundParamsSchema = z.object({
  competitionId: objectIdSchema,
  round: z.coerce.number().pipe(roundIdentifierSchema),
});

export const updateRoundStatusSchema = z.object({
  status: z.enum(ROUND_STATUSES),
});
