import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import { createApp } from "./app";
import { describeError } from "./utils/safe-log";

export interface ServerlessAppOptions {
  connectDatabase: () => Promise<unknown>;
  requiresDatabase?: (path: string) => boolean;
}

function defaultRequiresDatabase(path: string): boolean {
  return path.replace(/\/+$/, "") !== "/api/v1/health/live";
}

export function createServerlessApp(options: ServerlessAppOptions): Express {
  const requiresDatabase = options.requiresDatabase ?? defaultRequiresDatabase;

  const databaseMiddleware: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!requiresDatabase(req.path)) {
      next();
      return;
    }

    try {
      await options.connectDatabase();
    } catch (error) {
      console.error(
        `[serverless] Database connection failed for ${req.method} ${req.path}: ${describeError(error)}`,
      );
      res.status(503).json({
        error: {
          status: 503,
          code: "SERVICE_UNAVAILABLE",
          message: "Database unavailable",
        },
      });
      return;
    }

    next();
  };

  return createApp({ beforeRoutes: [databaseMiddleware] });
}
