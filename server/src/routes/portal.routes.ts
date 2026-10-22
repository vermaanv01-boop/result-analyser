import { Router } from "express";
import {
  getParticipantProfileHandler,
  getParticipantResultsHandler,
  getPublicCompetitionsHandler,
  updateParticipantTeamHandler,
} from "../controllers/portal.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { updateTeamSchema } from "../validators/portal.validators";

const router = Router();

// Public route to fetch active competitions for self-registration
router.get("/competitions", getPublicCompetitionsHandler);

// Participant protected routes
router.use(authenticate, requireRole("participant", "admin"));

router.get("/profile", getParticipantProfileHandler);
router.get("/results", getParticipantResultsHandler);
router.patch(
  "/team",
  validate({ body: updateTeamSchema }),
  updateParticipantTeamHandler,
);

export default router;
