import { z } from "zod";
import { LOGIN_ID_PATTERN, USER_ROLES } from "../models/user.model";
import { emailSchema, nonEmptyString, objectIdSchema } from "./common";

export const loginIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    LOGIN_ID_PATTERN,
    "loginId must be 3-32 characters and use only letters, numbers, dot, underscore, or hyphen",
  );

export const loginIdentifierSchema = z
  .string()
  .trim()
  .min(1, "identifier is required")
  .refine(
    (value) =>
      emailSchema.safeParse(value).success || loginIdSchema.safeParse(value).success,
    "identifier must be a valid email address or login ID",
  );

export const loginSchema = z
  .object({
    identifier: loginIdentifierSchema.optional(),
    email: emailSchema.optional(),
    password: z.string().min(1, "password is required"),
  })
  .superRefine((value, ctx) => {
    const hasIdentifier =
      typeof value.identifier === "string" && value.identifier.length > 0;
    const hasEmail = typeof value.email === "string" && value.email.length > 0;

    if (!hasIdentifier && !hasEmail) {
      ctx.addIssue({
        code: "custom",
        path: ["identifier"],
        message: "identifier is required",
      });
    }

    if (hasIdentifier && hasEmail) {
      ctx.addIssue({
        code: "custom",
        path: ["identifier"],
        message: "provide either identifier or email, not both",
      });
    }
  })
  .transform((value) => ({
    identifier: value.identifier ?? value.email ?? "",
    password: value.password,
  }));

export const createUserSchema = z.object({
  name: nonEmptyString(200, "name is required"),
  email: emailSchema,
  loginId: loginIdSchema.optional(),
  password: z.string().min(6, "password must be at least 6 characters"),
  role: z.enum(USER_ROLES),
  isActive: z.boolean().optional(),
});

export const registerParticipantSchema = z.object({
  competitionId: objectIdSchema,
  name: nonEmptyString(200, "Participant or team name is required"),
  registrationId: z.string().trim().min(1).max(64).optional(),
  email: emailSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
  teamMembers: z.array(z.string().trim().min(1).max(200)).optional(),
});

export const activateJudgeSchema = z.object({
  token: z.string().min(1, "activation token is required"),
  password: z.string().min(6, "password must be at least 6 characters"),
});
