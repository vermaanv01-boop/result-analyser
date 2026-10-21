import { Types } from "mongoose";
import { Competition } from "../models/competition.model";
import { Panel, type PanelDocument } from "../models/panel.model";
import { User } from "../models/user.model";
import { ApiError } from "../utils/api-error";

export async function createPanel(
  competitionId: string,
  data: {
    name: string;
    description?: string | null;
    judges: string[];
    isActive?: boolean;
  },
): Promise<PanelDocument> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  // Verify all judges exist, have role judge, and are active
  const judgeObjectIds = data.judges.map((id) => new Types.ObjectId(id));
  const foundJudges = await User.find({
    _id: { $in: judgeObjectIds },
    role: "judge",
  });

  if (foundJudges.length !== data.judges.length) {
    throw ApiError.badRequest(
      "One or more provided judge IDs are invalid, not assigned the judge role, or do not exist",
    );
  }

  const panel = new Panel({
    competition: competition._id,
    name: data.name.trim(),
    description: data.description?.trim() ?? null,
    judges: judgeObjectIds,
    isActive: data.isActive ?? true,
  });

  await panel.save();
  return panel;
}

export async function getPanels(
  competitionId: string,
): Promise<PanelDocument[]> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  return Panel.find({ competition: competition._id })
    .populate("judges", "name email isActive")
    .sort({ createdAt: 1 });
}

export async function getPanelById(
  competitionId: string,
  panelId: string,
): Promise<PanelDocument> {
  const panel = await Panel.findOne({
    _id: panelId,
    competition: competitionId,
  }).populate("judges", "name email isActive");

  if (!panel) {
    throw ApiError.notFound("Panel not found for this competition");
  }

  return panel;
}

export async function updatePanel(
  competitionId: string,
  panelId: string,
  data: {
    name?: string;
    description?: string | null;
    judges?: string[];
    isActive?: boolean;
  },
): Promise<PanelDocument> {
  const panel = await Panel.findOne({
    _id: panelId,
    competition: competitionId,
  });

  if (!panel) {
    throw ApiError.notFound("Panel not found for this competition");
  }

  if (data.name !== undefined) {
    panel.name = data.name.trim();
  }
  if (data.description !== undefined) {
    panel.description = data.description ? data.description.trim() : null;
  }
  if (data.isActive !== undefined) {
    panel.isActive = data.isActive;
  }
  if (data.judges !== undefined) {
    const judgeObjectIds = data.judges.map((id) => new Types.ObjectId(id));
    const foundJudges = await User.find({
      _id: { $in: judgeObjectIds },
      role: "judge",
    });

    if (foundJudges.length !== data.judges.length) {
      throw ApiError.badRequest(
        "One or more provided judge IDs are invalid or not assigned the judge role",
      );
    }
    panel.judges = judgeObjectIds;
  }

  await panel.save();
  return panel;
}
