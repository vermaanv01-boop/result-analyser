import type { Request, Response, NextFunction } from "express";
import { createApp } from "../src/app";
import { connectDatabase } from "../src/config/database";
import { describeError } from "../src/utils/safe-log";

console.log("[vercel] Initializing API function");
const app = createApp();
console.log("[vercel] Express app initialized");

let databaseReady: Promise<unknown> | null = null;

function ensureDatabase(): Promise<unknown> {
  if (!databaseReady) {
    databaseReady = connectDatabase().catch((error: unknown) => {
      databaseReady = null;
      throw error;
    });
  }

  return databaseReady;
}

function requiresDatabase(path: string): boolean {
  return path.replace(/\/+$/, "") !== "/api/v1/health/live";
}

// Database initialization middleware for serverless invocations
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (requiresDatabase(req.path)) {
    try {
      await ensureDatabase();
    } catch (error) {
      console.error(
        `[vercel] Database connection failed for ${req.method} ${req.path}: ${describeError(error)}`,
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
  }
  next();
});

export default app;

