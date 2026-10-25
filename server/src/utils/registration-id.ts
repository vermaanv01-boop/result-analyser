import { randomBytes } from "crypto";
import { Participant } from "../models/participant.model";

function generateRandomSuffix(length: number = 6): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte === undefined) {
      result += chars[Math.floor(Math.random() * chars.length)];
    } else {
      result += chars[byte % chars.length];
    }
  }
  return result;
}

export async function generateUniqueRegistrationId(
  competitionId: string | any,
  prefix: string = "REG",
): Promise<string> {
  let attempts = 0;
  const maxAttempts = 50;

  while (attempts < maxAttempts) {
    const suffix = generateRandomSuffix(6);
    const candidate = (prefix + "-" + suffix).toUpperCase();

    const existing = await Participant.findOne({
      competition: competitionId,
      registrationId: candidate,
    });

    if (!existing) {
      return candidate;
    }

    attempts++;
  }

  const timestamp = Date.now().toString().slice(-6);
  const fallback = (prefix + "-" + timestamp).toUpperCase();
  const existingFallback = await Participant.findOne({
    competition: competitionId,
    registrationId: fallback,
  });

  if (!existingFallback) {
    return fallback;
  }

  return (prefix + "-" + generateRandomSuffix(8)).toUpperCase();
}
