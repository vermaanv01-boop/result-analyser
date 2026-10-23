import { Router } from "express";
import {
  createCompetitionHandler,
  getCompetitionHandler,
  listCompetitionsHandler,
  updateCompetitionHandler,
  updateRoundStatusHandler,
} from "../controllers/competition.controller";
import { getProgressReportHandler } from "../controllers/evaluation.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  competitionIdParamsSchema,
  createCompetitionSchema,
  roundParamsSchema,
  updateCompetitionSchema,
  updateRoundStatusSchema,
} from "../validators/competition.validators";
import leaderboardRoutes from "./leaderboard.routes";
import panelRoutes from "./panel.routes";
import parameterRoutes from "./parameter.routes";
import participantRoutes from "./participant.routes";

const router = Router();

// Live leaderboards are a documented public read-only surface.
router.use("/:competitionId/leaderboard", leaderboardRoutes);

router.use(authenticate);

router.use("/:competitionId/panels", panelRoutes);
router.use("/:competitionId/participants", participantRoutes);
router.use("/:competitionId/parameters", parameterRoutes);

router.post(
  "/",
  requireRole("admin"),
  validate({ body: createCompetitionSchema }),
  createCompetitionHandler,
);

router.get("/", listCompetitionsHandler);

router.get(
  "/:competitionId",
  validate({ params: competitionIdParamsSchema }),
  getCompetitionHandler,
);

router.patch(
  "/:competitionId",
  requireRole("admin"),
  validate({
    params: competitionIdParamsSchema,
    body: updateCompetitionSchema,
  }),
  updateCompetitionHandler,
);

router.post(
  "/:competitionId/rounds/:round/status",
  requireRole("admin"),
  validate({
    params: roundParamsSchema,
    body: updateRoundStatusSchema,
  }),
  updateRoundStatusHandler,
);

router.get(
  "/:competitionId/progress",
  requireRole("admin"),
  validate({ params: competitionIdParamsSchema }),
  getProgressReportHandler,
);

export default router;
