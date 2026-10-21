import { Router } from "express";
import {
  loginHandler,
  meHandler,
  provisionUserHandler,
} from "../controllers/auth.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createUserSchema,
  loginSchema,
} from "../validators/auth.validators";

const router = Router();

router.post("/login", validate({ body: loginSchema }), loginHandler);

router.get("/me", authenticate, meHandler);

router.post(
  "/users",
  authenticate,
  requireRole("admin"),
  validate({ body: createUserSchema }),
  provisionUserHandler,
);

export default router;
