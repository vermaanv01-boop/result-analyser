import { z } from "zod";
import { nonEmptyString, objectIdSchema } from "./common";

export const createPanelSchema = z.object({
  name: nonEmptyString(200, "name is required"),
  description: z.string().trim().max(2000).nullable().optional(),
  judges: z.array(objectIdSchema).min(1, "judges must contain at least one judge"),
  isActive: z.boolean().optional(),
});

export const updatePanelSchema = z.object({
  name: nonEmptyString(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  judges: z.array(objectIdSchema).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const panelParamsSchema = z.object({
  competitionId: objectIdSchema,
  panelId: objectIdSchema,
});
