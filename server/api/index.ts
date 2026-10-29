import type { Request, Response } from "express";
import { createApp } from "../src/app";
import { connectDatabase } from "../src/config/database";

const app = createApp();

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

export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    await ensureDatabase();
  } catch {
    console.error("[vercel] Database connection failed");
    sendServiceUnavailable(res);
    return;
  }

  app(req, res);
}
