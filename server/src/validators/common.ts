import { z } from "zod";
import { ROUND_IDENTIFIERS } from "../types/domain.types";
import { isNonNegativeNumber, isPositiveNumber } from "../utils/validation";

export const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export const objectIdSchema = z
  .string()
  .regex(OBJECT_ID_PATTERN, "must be a valid MongoDB ObjectId");

export const idParamsSchema = z.object({ id: objectIdSchema });

export function nonEmptyString(maxLength: number, emptyMessage?: string) {
  return z
    .string()
    .trim()
    .min(1, emptyMessage ?? "must not be empty")
    .max(maxLength, `must be at most ${maxLength} characters`);
}

export const emailSchema = z.email("must be a valid email address");

export const positiveNumberSchema = z
  .number()
  .refine(isPositiveNumber, "must be a finite positive number");

export const nonNegativeNumberSchema = z
  .number()
  .refine(isNonNegativeNumber, "must be a finite non-negative number");

export const roundIdentifierSchema = z.literal(ROUND_IDENTIFIERS);
