import type { NextFunction, Request, Response } from "express";
import { Panel } from "../models/panel.model";
import { User, type UserRole } from "../models/user.model";
import { verifyToken } from "../services/auth.service";
import type { AuthenticatedUser } from "../types/auth.types";
import { ApiError } from "../utils/api-error";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    next(ApiError.unauthorized("Authorization header is required"));
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || !parts[1]) {
    next(ApiError.unauthorized("Authorization format must be 'Bearer <token>'"));
    return;
  }

  const token = parts[1];

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      next(ApiError.unauthorized("User account no longer exists"));
      return;
    }

    if (!user.isActive) {
      next(ApiError.forbidden("Account is deactivated"));
      return;
    }

    const principal: AuthenticatedUser = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    };

    req.user = principal;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized("Authentication required"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(
        ApiError.forbidden(
          `Access denied. Requires one of roles: ${roles.join(", ")}`,
        ),
      );
      return;
    }

    next();
  };
}

export async function requireJudgePanelAccess(
  judgeId: string,
  panelId: string,
): Promise<void> {
  const panel = await Panel.findById(panelId);
  if (!panel) {
    throw ApiError.notFound("Panel not found");
  }

  const isAssigned = panel.judges.some((id) => id.toString() === judgeId);
  if (!isAssigned) {
    throw ApiError.forbidden("Judge is not assigned to this panel");
  }
}
