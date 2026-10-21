import { z } from "zod";
import {
  emailSchema,
  nonEmptyString,
  objectIdSchema,
  roundIdentifierSchema,
} from "./common";

export const createParticipantSchema = z.object({
  name: nonEmptyString(200, "name is required"),
  registrationId: nonEmptyString(64, "registrationId is required"),
  email: emailSchema.nullable().optional(),
  panel: objectIdSchema.nullable().optional(),
});

export const updateParticipantSchema = z.object({
  name: nonEmptyString(200).optional(),
  registrationId: nonEmptyString(64).optional(),
  email: emailSchema.nullable().optional(),
  panel: objectIdSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

export const participantParamsSchema = z.object({
  competitionId: objectIdSchema,
  participantId: objectIdSchema,
});

export const participantQuerySchema = z.object({
  panel: objectIdSchema.optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  round: z.coerce.number().pipe(roundIdentifierSchema).optional(),
});

export const updateEligibilitySchema = z.object({
  round: z.coerce.number().pipe(roundIdentifierSchema),
  eligible: z.boolean(),
  ineligibleReason: z.string().trim().max(500).nullable().optional(),
});

export const qualifyRound2Schema = z.object({
  method: z.enum(["explicit", "topN", "cutoffScore"]),
  participantIds: z.array(objectIdSchema).optional(),
  topN: z.number().int().positive().optional(),
  cutoffScore: z.number().min(0).optional(),
});
