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

const router = Router();

router.use(authenticate);

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
