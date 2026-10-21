import { Router } from "express";
import {
  createParameterHandler,
  getParameterHandler,
  listParametersHandler,
  updateParameterHandler,
} from "../controllers/parameter.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { competitionIdParamsSchema } from "../validators/competition.validators";
import {
  createParameterSchema,
  parameterParamsSchema,
  parameterQuerySchema,
  updateParameterSchema,
} from "../validators/parameter.validators";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post(
  "/",
  requireRole("admin"),
  validate({
    params: competitionIdParamsSchema,
    body: createParameterSchema,
  }),
  createParameterHandler,
);

router.get(
  "/",
  validate({
    params: competitionIdParamsSchema,
    query: parameterQuerySchema,
  }),
  listParametersHandler,
);

router.get(
  "/:parameterId",
  validate({ params: parameterParamsSchema }),
  getParameterHandler,
);

router.patch(
  "/:parameterId",
  requireRole("admin"),
  validate({
    params: parameterParamsSchema,
    body: updateParameterSchema,
  }),
  updateParameterHandler,
);

export default router;
