import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { User, type UserRole } from "../models/user.model";
import type { AuthenticatedUser, AuthTokenPayload } from "../types/auth.types";
import { ApiError } from "../utils/api-error";

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

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}
