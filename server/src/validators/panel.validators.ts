import { z } from "zod";
import { nonEmptyString, objectIdSchema } from "./common";

const uniqueJudgeIdsSchema = z
  .array(objectIdSchema)
  .min(1, "judges must contain at least one judge")
  .superRefine((judgeIds, context) => {
    const seen = new Set<string>();

    judgeIds.forEach((judgeId, index) => {
      const normalized = judgeId.toLowerCase();
      if (seen.has(normalized)) {
        context.addIssue({
          code: "custom",
          message: "judges must not contain duplicate IDs",
          path: [index],
        });
      }
      seen.add(normalized);
    });
  });

export const createPanelSchema = z.object({
  name: nonEmptyString(200, "name is required"),
  description: z.string().trim().max(2000).nullable().optional(),
  judges: uniqueJudgeIdsSchema,
  isActive: z.boolean().optional(),
});

export const updatePanelSchema = z.object({
  name: nonEmptyString(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  judges: uniqueJudgeIdsSchema.optional(),
  isActive: z.boolean().optional(),
});

export const panelParamsSchema = z.object({
  competitionId: objectIdSchema,
  panelId: objectIdSchema,
});
