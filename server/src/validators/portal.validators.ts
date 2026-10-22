import { z } from "zod";
import { nonEmptyString } from "./common";

export const updateTeamSchema = z.object({
  name: nonEmptyString(200, "Team or participant name cannot be empty").optional(),
  teamMembers: z.array(z.string().trim().min(1).max(200)).optional(),
});
