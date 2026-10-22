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

export const activateJudgeSchema = z.object({
  token: z.string().min(1, "activation token is required"),
  password: z.string().min(6, "password must be at least 6 characters"),
});
