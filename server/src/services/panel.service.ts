import { Types } from "mongoose";
import { Competition } from "../models/competition.model";
import { Panel, type PanelDocument } from "../models/panel.model";
import { User } from "../models/user.model";
import { ApiError } from "../utils/api-error";

interface JudgeCandidate {
  _id: Types.ObjectId;
  role: string;
  isActive: boolean;
}

export function normalizeJudgeIds(judgeIds: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalizedIds: string[] = [];

  for (const rawId of judgeIds) {
    const id = rawId.trim();

    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest("One or more selected judge IDs are invalid.");
    }

    const normalized = id.toLowerCase();
    if (seen.has(normalized)) {
      throw ApiError.badRequest("Duplicate judge IDs are not allowed.");
    }

    seen.add(normalized);
    normalizedIds.push(normalized);
  }

  if (normalizedIds.length === 0) {
    throw ApiError.badRequest("Select at least one judge for the panel.");
  }

  return normalizedIds;
}

export function assertEligibleJudgeCandidates(
  judgeIds: readonly string[],
  candidates: readonly JudgeCandidate[],
): void {
  const candidatesById = new Map(
    candidates.map((candidate) => [candidate._id.toString().toLowerCase(), candidate]),
  );

  const missing = judgeIds.filter((id) => !candidatesById.has(id.toLowerCase()));
  if (missing.length > 0) {
    throw ApiError.badRequest(
      "One or more selected judge accounts do not exist.",
    );
  }

  const notJudges = judgeIds.filter((id) => {
    const candidate = candidatesById.get(id.toLowerCase());
    return candidate !== undefined && candidate.role !== "judge";
  });
  if (notJudges.length > 0) {
    throw ApiError.badRequest(
      "One or more selected accounts do not have the judge role.",
    );
  }

  const inactiveJudges = judgeIds.filter((id) => {
    const candidate = candidatesById.get(id.toLowerCase());
    return candidate !== undefined && candidate.role === "judge" && !candidate.isActive;
  });
  if (inactiveJudges.length > 0) {
    throw ApiError.badRequest(
      "Inactive judge accounts cannot be assigned to a panel.",
    );
  }
}

async function resolveJudgeIds(judgeIds: readonly string[]): Promise<Types.ObjectId[]> {
  const normalizedIds = normalizeJudgeIds(judgeIds);
  const objectIds = normalizedIds.map((id) => new Types.ObjectId(id));
  const candidates = await User.find({ _id: { $in: objectIds } });

  assertEligibleJudgeCandidates(normalizedIds, candidates);

  return objectIds;
}

export async function createPanel(
  competitionId: string,
  data: {
    name: string;
    description?: string | null | undefined;
    judges: string[];
    isActive?: boolean | undefined;
  },
): Promise<PanelDocument> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  const judgeObjectIds = await resolveJudgeIds(data.judges);

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
    name?: string | undefined;
    description?: string | null | undefined;
    judges?: string[] | undefined;
    isActive?: boolean | undefined;
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
    panel.judges = await resolveJudgeIds(data.judges);
  }

  await panel.save();
  return panel;
}
