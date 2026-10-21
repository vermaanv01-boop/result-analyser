import { Router } from "express";
import {
  createParticipantHandler,
  getParticipantHandler,
  listParticipantsHandler,
  qualifyRound2Handler,
  updateEligibilityHandler,
  updateParticipantHandler,
} from "../controllers/participant.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { competitionIdParamsSchema } from "../validators/competition.validators";
import {
  createParticipantSchema,
  participantParamsSchema,
  participantQuerySchema,
  qualifyRound2Schema,
  updateEligibilitySchema,
  updateParticipantSchema,
} from "../validators/participant.validators";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post(
  "/",
  requireRole("admin"),
  validate({
    params: competitionIdParamsSchema,
    body: createParticipantSchema,
  }),
  createParticipantHandler,
);

router.get(
  "/",
  validate({
    params: competitionIdParamsSchema,
    query: participantQuerySchema,
  }),
  listParticipantsHandler,
);

router.post(
  "/qualify-round-2",
  requireRole("admin"),
  validate({
    params: competitionIdParamsSchema,
    body: qualifyRound2Schema,
  }),
  qualifyRound2Handler,
);

router.get(
  "/:participantId",
  validate({ params: participantParamsSchema }),
  getParticipantHandler,
);

router.patch(
  "/:participantId",
  requireRole("admin"),
  validate({
    params: participantParamsSchema,
    body: updateParticipantSchema,
  }),
  updateParticipantHandler,
);

router.patch(
  "/:participantId/eligibility",
  requireRole("admin"),
  validate({
    params: participantParamsSchema,
    body: updateEligibilitySchema,
  }),
  updateEligibilityHandler,
);

export default router;
