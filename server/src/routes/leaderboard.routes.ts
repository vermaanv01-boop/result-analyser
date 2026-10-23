import { Router } from "express";
import {
  getOverallLeaderboardHandler,
  getPanelLeaderboardHandler,
  getRoundLeaderboardHandler,
} from "../controllers/leaderboard.controller";
import { validate } from "../middleware/validate";
import {
  competitionIdParamsSchema,
  roundParamsSchema,
} from "../validators/competition.validators";
import { panelParamsSchema } from "../validators/panel.validators";

const router = Router({ mergeParams: true });

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
