import { Router } from "express";
import {
  getEvaluationHandler,
  listEvaluationsHandler,
  saveDraftHandler,
  submitEvaluationHandler,
} from "../controllers/evaluation.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idParamsSchema } from "../validators/common";
import {
  evaluationQuerySchema,
  saveEvaluationSchema,
} from "../validators/evaluation.validators";

const router = Router();

router.use(authenticate);

router.post(
  "/draft",
  requireRole("judge", "admin"),
  validate({ body: saveEvaluationSchema }),
  saveDraftHandler,
);

router.post(
  "/submit",
  requireRole("judge", "admin"),
  validate({ body: saveEvaluationSchema }),
  submitEvaluationHandler,
);

router.get(
  "/",
  requireRole("admin"),
  validate({ query: evaluationQuerySchema }),
  listEvaluationsHandler,
);

router.get(
  "/:id",
  requireRole("judge", "admin"),
  validate({ params: idParamsSchema }),
  getEvaluationHandler,
);

export default router;
