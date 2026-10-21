import type { UserRole } from "../models/user.model";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
