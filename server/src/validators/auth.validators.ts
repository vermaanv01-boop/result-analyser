import { z } from "zod";
import { USER_ROLES } from "../models/user.model";
import { emailSchema, nonEmptyString, objectIdSchema } from "./common";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "password is required"),
});

export const createUserSchema = z.object({
  name: nonEmptyString(200, "name is required"),
  email: emailSchema,
  password: z.string().min(6, "password must be at least 6 characters"),
  role: z.enum(USER_ROLES),
  isActive: z.boolean().optional(),
});

export const registerParticipantSchema = z.object({
  competitionId: objectIdSchema,
  name: nonEmptyString(200, "Participant or team name is required"),
  registrationId: nonEmptyString(64, "Registration ID is required"),
  email: emailSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
  teamMembers: z.array(z.string().trim().min(1).max(200)).optional(),
});
