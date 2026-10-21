import type { NextFunction, Request, Response } from "express";
import { ApiError, ERROR_CODES } from "../utils/api-error";

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(
    new ApiError(404, `Route ${req.method} ${req.path} not found`, {
      code: ERROR_CODES.NOT_FOUND,
    }),
  );
}
