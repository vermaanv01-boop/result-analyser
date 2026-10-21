import { z } from "zod";
import {
  nonEmptyString,
  nonNegativeNumberSchema,
  objectIdSchema,
  positiveNumberSchema,
  roundIdentifierSchema,
} from "./common";

export const createParameterSchema = z.object({
  name: nonEmptyString(200, "name is required"),
  description: z.string().trim().max(2000).nullable().optional(),
  guidelines: z.string().trim().max(5000).nullable().optional(),
  maxMarks: positiveNumberSchema,
  weightage: nonNegativeNumberSchema.default(1),
  applicableRounds: z
    .array(roundIdentifierSchema)
    .min(1, "applicableRounds must contain at least one round"),
  isActive: z.boolean().optional(),
});

export const updateParameterSchema = z.object({
  name: nonEmptyString(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  guidelines: z.string().trim().max(5000).nullable().optional(),
  maxMarks: positiveNumberSchema.optional(),
  weightage: nonNegativeNumberSchema.optional(),
  applicableRounds: z.array(roundIdentifierSchema).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const parameterParamsSchema = z.object({
  competitionId: objectIdSchema,
  parameterId: objectIdSchema,
});

export const parameterQuerySchema = z.object({
  round: z.coerce.number().pipe(roundIdentifierSchema).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});
