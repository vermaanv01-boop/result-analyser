import type { NextFunction, Response } from "express";
import type { ValidatedRequest } from "../middleware/validate";
import {
  getJudges,
  login,
  provisionUser,
  registerParticipant,
} from "../services/auth.service";
import type {
  activateJudgeSchema,
  createUserSchema,
  loginSchema,
  registerParticipantSchema,
} from "../validators/auth.validators";
import { activateJudgeAccount } from "../services/notification.service";

export async function loginHandler(
  req: ValidatedRequest<{ body: typeof loginSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await login(req.body.email, req.body.password);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function registerParticipantHandler(
  req: ValidatedRequest<{ body: typeof registerParticipantSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await registerParticipant(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export function meHandler(
  req: ValidatedRequest<{}>,
  res: Response,
  next: NextFunction,
): void {
  try {
    res.status(200).json({ user: req.user });
  } catch (error) {
    next(error);
  }
}

export async function listJudgesHandler(
  _req: ValidatedRequest<{}>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const judges = await getJudges();
    res.status(200).json({ judges });
  } catch (error) {
    next(error);
  }
}

export async function provisionUserHandler(
  req: ValidatedRequest<{ body: typeof createUserSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await provisionUser(req.body);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function activateJudgeHandler(
  req: ValidatedRequest<{ body: typeof activateJudgeSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await activateJudgeAccount(req.body.token, req.body.password);
    res.status(200).json({ message: "Judge account activated", user: result });
  } catch (error) {
    next(error);
  }
}
