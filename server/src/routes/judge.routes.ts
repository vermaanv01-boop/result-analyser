import { Router } from "express";
import {
  getJudgeEvaluationsHandler,
  getJudgePanelParticipantsHandler,
  getJudgePanelsHandler,
} from "../controllers/judge.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idParamsSchema } from "../validators/common";

const router = Router();

router.use(authenticate, requireRole("judge"));

router.get("/panels", getJudgePanelsHandler);

router.get(
  "/panels/:id/participants",
  validate({ params: idParamsSchema }),
  getJudgePanelParticipantsHandler,
);

router.get("/evaluations", getJudgeEvaluationsHandler);

export default router;
