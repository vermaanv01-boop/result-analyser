import type { NextFunction, Response } from "express";
import { Types } from "mongoose";
import { Competition } from "../models/competition.model";
import { Evaluation } from "../models/evaluation.model";
import { Panel } from "../models/panel.model";
import { Participant } from "../models/participant.model";
import { ApiError } from "../utils/api-error";
import { idParamsSchema } from "../validators/common";
import type { ValidatedRequest } from "../middleware/validate";

export async function getJudgePanelsHandler(
  req: ValidatedRequest<{}>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const judgeObjectId = new Types.ObjectId(req.user!.id);
    const panels = await Panel.find({
      judges: judgeObjectId,
      isActive: true,
    })
      .populate("competition", "name status rounds")
      .sort({ createdAt: -1 });

    res.status(200).json({ panels });
  } catch (error) {
    next(error);
  }
}

export async function getJudgePanelParticipantsHandler(
  req: ValidatedRequest<{ params: typeof idParamsSchema }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const judgeObjectId = new Types.ObjectId(req.user!.id);
    const panel = await Panel.findById(req.params.id).populate(
      "competition",
      "name status rounds",
    );

    if (!panel) {
      throw ApiError.notFound("Panel not found");
    }

    const isAssigned = panel.judges.some((j) => j.toString() === req.user!.id);

    if (!isAssigned) {
      throw ApiError.forbidden("Judge is not assigned to this panel");
    }

    const competition = await Competition.findById(panel.competition);
    if (!competition) {
      throw ApiError.notFound("Competition not found");
    }

    const activeRound =
      competition.rounds.find((r) => r.status === "active")?.round ?? null;

    const participants = await Participant.find({
      panel: panel._id,
      competition: competition._id,
      isActive: true,
    }).sort({ registrationId: 1 });

    // Find any evaluations already created by this judge
    const evaluations = await Evaluation.find({
      panel: panel._id,
      judge: judgeObjectId,
      ...(activeRound ? { round: activeRound } : {}),
    });

    const evalMap = new Map<string, string>();
    evaluations.forEach((e) => {
      evalMap.set(e.participant.toString(), e.status);
    });

    const participantList = participants.map((p) => {
      const pId = p._id.toString();
      const isEligible = activeRound
        ? (p.eligibility.find((e) => e.round === activeRound)?.eligible ?? false)
        : false;

      return {
        id: pId,
        name: p.name,
        registrationId: p.registrationId,
        isEligible,
        evaluationStatus: evalMap.get(pId) ?? "none",
      };
    });

    res.status(200).json({
      panel: {
        id: panel._id.toString(),
        name: panel.name,
        competitionId: competition._id.toString(),
        competitionName: competition.name,
      },
      activeRound,
      participants: participantList,
    });
  } catch (error) {
    next(error);
  }
}

export async function getJudgeEvaluationsHandler(
  req: ValidatedRequest<{}>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const judgeObjectId = new Types.ObjectId(req.user!.id);
    const evaluations = await Evaluation.find({ judge: judgeObjectId })
      .populate("participant", "name registrationId")
      .populate("panel", "name")
      .populate("competition", "name")
      .sort({ updatedAt: -1 });

    res.status(200).json({ evaluations });
  } catch (error) {
    next(error);
  }
}
