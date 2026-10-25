import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { Competition } from "../models/competition.model";
import { Participant, type ParticipantDocument } from "../models/participant.model";
import { User, type UserRole } from "../models/user.model";
import type { AuthenticatedUser, AuthTokenPayload } from "../types/auth.types";
import { ApiError } from "../utils/api-error";
import { generateUniqueRegistrationId } from "../utils/registration-id";
import { sendJudgeActivationEmail, sendParticipantRegistrationConfirmation } from "./notification.service";

const SALT_ROUNDS = 10;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function comparePassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as unknown as jwt.SignOptions);
}

export function verifyToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "sub" in decoded &&
      "email" in decoded &&
      "role" in decoded
    ) {
      return decoded as unknown as AuthTokenPayload;
    }
    throw ApiError.unauthorized("Invalid token payload structure");
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.unauthorized("Authentication token is invalid or expired");
  }
}

export interface LoginResult {
  token: string;
  user: AuthenticatedUser;
}

export async function login(email: string, plaintext: string): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (!user.isActive) {
    throw ApiError.forbidden("Account is deactivated");
  }

  const isMatch = await comparePassword(plaintext, user.passwordHash);
  if (!isMatch) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const payload: AuthTokenPayload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const token = signToken(payload);

  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  };
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive?: boolean | undefined;
}

export async function provisionUser(data: CreateUserData): Promise<AuthenticatedUser> {
  const normalizedEmail = data.email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    throw ApiError.conflict("User with this email already exists");
  }

  const passwordHash = await hashPassword(data.password);
  const user = await User.create({
    name: data.name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: data.role,
    isActive: data.isActive ?? true,
  });

  if (user.role === "judge") {
    // Send activation/setup email; delivery failures must not fail account creation.
    try {
      await sendJudgeActivationEmail({
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
      });
    } catch (error) {
      console.error("Failed to send judge activation email:", error instanceof Error ? error.message : "unknown");
    }
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function getJudges(): Promise<AuthenticatedUser[]> {
  const judges = await User.find({ role: "judge" }).sort({ name: 1 });
  return judges.map((j) => ({
    id: j._id.toString(),
    name: j.name,
    email: j.email,
    role: j.role,
    isActive: j.isActive,
  }));
}

export interface RegisterParticipantData {
  competitionId: string;
  name: string;
  registrationId?: string | null | undefined;
  email: string;
  password: string;
  teamMembers?: string[] | undefined;
}

export interface RegisterParticipantResult {
  token: string;
  user: AuthenticatedUser;
  participant: {
    id: string;
    name: string;
    registrationId: string;
    competitionId: string;
    competitionName: string;
    teamMembers: string[];
  };
}

export async function registerParticipant(
  data: RegisterParticipantData,
): Promise<RegisterParticipantResult> {
  const competition = await Competition.findById(data.competitionId);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }
  if (competition.status === "archived") {
    throw ApiError.badRequest("Competition is archived and not accepting registrations");
  }

  const normalizedEmail = data.email.trim().toLowerCase();

  let normalizedRegId: string | undefined;
  if (data.registrationId && data.registrationId.trim()) {
    normalizedRegId = data.registrationId.trim().toUpperCase();
    // Check if registrationId is already used in this competition by another participant
    const existingReg = await Participant.findOne({
      competition: competition._id,
      registrationId: normalizedRegId,
    });

    if (existingReg && existingReg.email && existingReg.email !== normalizedEmail) {
      throw ApiError.conflict(
        `Participant with registration ID '${normalizedRegId}' already exists in this competition`,
      );
    }
  } else {
    normalizedRegId = await generateUniqueRegistrationId(competition._id, "REG");
  }

  // Find or create User account with role 'participant'
  let user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
  if (user) {
    if (user.role !== "participant") {
      throw ApiError.conflict("An account with this email already exists with an administrator or judge role.");
    }
    const isMatch = await comparePassword(data.password, user.passwordHash);
    if (!isMatch) {
      throw ApiError.conflict("An account with this email already exists. Please verify your password or sign in.");
    }
  } else {
    const passwordHash = await hashPassword(data.password);
    user = await User.create({
      name: data.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "participant",
      isActive: true,
    });
  }

  let participantDoc: ParticipantDocument;
  if (existingReg) {
    existingReg.user = user._id;
    existingReg.name = data.name.trim();
    if (!existingReg.registrationId) {
      existingReg.registrationId = await generateUniqueRegistrationId(competition._id, "REG");
    }
    if (data.teamMembers && data.teamMembers.length > 0) {
      existingReg.teamMembers = data.teamMembers.map((m) => m.trim()).filter(Boolean);
    }
    await existingReg.save();
    participantDoc = existingReg;
  } else {
    participantDoc = new Participant({
      competition: competition._id,
      user: user._id,
      name: data.name.trim(),
      registrationId: normalizedRegId!,
      email: normalizedEmail,
      panel: null,
      isActive: true,
      teamMembers: (data.teamMembers || []).map((m) => m.trim()).filter(Boolean),
    });
    await participantDoc.save();
  }

  const payload: AuthTokenPayload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const token = signToken(payload);

  // Send registration confirmation email; delivery failures must not undo
  // a successfully persisted registration.
  try {
    await sendParticipantRegistrationConfirmation({
      email: normalizedEmail,
      participantName: data.name.trim(),
      competitionId: competition._id.toString(),
      registrationId: normalizedRegId,
    });
  } catch (error) {
    console.error(
      "Failed to send participant registration confirmation email:",
      error instanceof Error ? error.message : "unknown",
    );
  }

  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
    participant: {
      id: participantDoc._id.toString(),
      name: participantDoc.name,
      registrationId: participantDoc.registrationId,
      competitionId: competition._id.toString(),
      competitionName: competition.name,
      teamMembers: participantDoc.teamMembers,
    },
  };
}

