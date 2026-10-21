import { Router } from "express";
import {
  getOverallLeaderboardHandler,
  getPanelLeaderboardHandler,
  getRoundLeaderboardHandler,
} from "../controllers/leaderboard.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  competitionIdParamsSchema,
  roundParamsSchema,
} from "../validators/competition.validators";
import { panelParamsSchema } from "../validators/panel.validators";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get(
  "/",
  validate({ params: competitionIdParamsSchema }),
  getOverallLeaderboardHandler,
);

router.get(
  "/round/:round",
  validate({ params: roundParamsSchema }),
  getRoundLeaderboardHandler,
);

router.get(
  "/panel/:panelId",
  validate({ params: panelParamsSchema }),
  getPanelLeaderboardHandler,
);

export default router;
