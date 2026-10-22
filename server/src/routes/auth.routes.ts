import { Router } from "express";
import {
  activateJudgeHandler,
  listJudgesHandler,
  loginHandler,
  meHandler,
  provisionUserHandler,
  registerParticipantHandler,
} from "../controllers/auth.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  activateJudgeSchema,
  createUserSchema,
  loginSchema,
  registerParticipantSchema,
} from "../validators/auth.validators";

const router = Router();

router.post("/login", validate({ body: loginSchema }), loginHandler);

router.post(
  "/register-participant",
  validate({ body: registerParticipantSchema }),
  registerParticipantHandler,
);

router.post("/judge/activate", validate({ body: activateJudgeSchema }), activateJudgeHandler);

router.get("/me", authenticate, meHandler);

router.get("/judges", authenticate, requireRole("admin"), listJudgesHandler);

router.post(
  "/users",
  authenticate,
  requireRole("admin"),
  validate({ body: createUserSchema }),
  provisionUserHandler,
);

export default router;
