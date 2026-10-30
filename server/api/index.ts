import type { Request, Response } from "express";
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

function sendServiceUnavailable(res: Response): void {
  res.status(503).json({
    error: {
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Database unavailable",
    },
  });
}

function requiresDatabase(path: string): boolean {
  return path.replace(/\/+$/, "") !== "/api/v1/health/live";
}

export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  if (requiresDatabase(req.path)) {
    try {
      await ensureDatabase();
    } catch (error) {
      console.error(
        `[vercel] Database connection failed for ${req.method} ${req.path}: ${describeError(error)}`,
      );
      sendServiceUnavailable(res);
      return;
    }
  }

  app(req, res);
}
