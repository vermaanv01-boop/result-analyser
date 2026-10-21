import { Router } from "express";
import {
  createPanelHandler,
  getPanelHandler,
  listPanelsHandler,
  updatePanelHandler,
} from "../controllers/panel.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { competitionIdParamsSchema } from "../validators/competition.validators";
import {
  createPanelSchema,
  panelParamsSchema,
  updatePanelSchema,
} from "../validators/panel.validators";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post(
  "/",
  requireRole("admin"),
  validate({
    params: competitionIdParamsSchema,
    body: createPanelSchema,
  }),
  createPanelHandler,
);

router.get(
  "/",
  validate({ params: competitionIdParamsSchema }),
  listPanelsHandler,
);

router.get(
  "/:panelId",
  validate({ params: panelParamsSchema }),
  getPanelHandler,
);

router.patch(
  "/:panelId",
  requireRole("admin"),
  validate({
    params: panelParamsSchema,
    body: updatePanelSchema,
  }),
  updatePanelHandler,
);

export default router;
