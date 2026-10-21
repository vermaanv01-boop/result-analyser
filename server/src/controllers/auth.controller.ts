import type { NextFunction, Response } from "express";
import type { ValidatedRequest } from "../middleware/validate";
import { login, provisionUser } from "../services/auth.service";
import type {
  createUserSchema,
  loginSchema,
} from "../validators/auth.validators";

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
