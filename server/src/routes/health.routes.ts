import { Router, type Request, type Response } from "express";
import { getDatabaseState } from "../config/database";

const router: Router = Router();

router.get("/live", (_req: Request, res: Response): void => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.get("/ready", (_req: Request, res: Response): void => {
  const database = getDatabaseState();

  if (database !== "connected") {
    res.status(503).json({
      status: "not_ready",
      database,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(200).json({
    status: "ready",
    database,
    timestamp: new Date().toISOString(),
  });
});

export default router;
