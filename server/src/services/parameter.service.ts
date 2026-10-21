import { Competition } from "../models/competition.model";
import {
  EvaluationParameter,
  type EvaluationParameterDocument,
} from "../models/evaluation-parameter.model";
import type { RoundIdentifier } from "../types/domain.types";
import { ApiError } from "../utils/api-error";

export async function createParameter(
  competitionId: string,
  data: {
    name: string;
    description?: string | null;
    guidelines?: string | null;
    maxMarks: number;
    weightage: number;
    applicableRounds: RoundIdentifier[];
    isActive?: boolean;
  },
): Promise<EvaluationParameterDocument> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  const parameter = new EvaluationParameter({
    competition: competition._id,
    name: data.name.trim(),
    description: data.description ? data.description.trim() : null,
    guidelines: data.guidelines ? data.guidelines.trim() : null,
    maxMarks: data.maxMarks,
    weightage: data.weightage,
    applicableRounds: data.applicableRounds,
    isActive: data.isActive ?? true,
    configVersion: competition.parameterConfigVersion,
  });

  await parameter.save();
  return parameter;
}

export async function getParameters(
  competitionId: string,
  filters: {
    round?: RoundIdentifier;
    isActive?: boolean;
  },
): Promise<EvaluationParameterDocument[]> {
  const query: Record<string, unknown> = { competition: competitionId };

  if (filters.isActive !== undefined) {
    query["isActive"] = filters.isActive;
  }

  if (filters.round !== undefined) {
    query["applicableRounds"] = filters.round;
  }

  return EvaluationParameter.find(query).sort({ createdAt: 1 });
}

export async function getParameterById(
  competitionId: string,
  parameterId: string,
): Promise<EvaluationParameterDocument> {
  const parameter = await EvaluationParameter.findOne({
    _id: parameterId,
    competition: competitionId,
  });

  if (!parameter) {
    throw ApiError.notFound("Evaluation parameter not found for this competition");
  }

  return parameter;
}

export async function updateParameter(
  competitionId: string,
  parameterId: string,
  data: {
    name?: string;
    description?: string | null;
    guidelines?: string | null;
    maxMarks?: number;
    weightage?: number;
    applicableRounds?: RoundIdentifier[];
    isActive?: boolean;
  },
): Promise<EvaluationParameterDocument> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  const parameter = await EvaluationParameter.findOne({
    _id: parameterId,
    competition: competitionId,
  });

  if (!parameter) {
    throw ApiError.notFound("Evaluation parameter not found for this competition");
  }

  const scoringFieldsChanged =
    (data.maxMarks !== undefined && data.maxMarks !== parameter.maxMarks) ||
    (data.weightage !== undefined && data.weightage !== parameter.weightage) ||
    (data.name !== undefined && data.name.trim() !== parameter.name) ||
    (data.applicableRounds !== undefined &&
      JSON.stringify(data.applicableRounds) !==
        JSON.stringify(parameter.applicableRounds));

  if (scoringFieldsChanged) {
    // Increment competition parameter configuration version so future evaluations capture the new version
    competition.parameterConfigVersion += 1;
    await competition.save();
    parameter.configVersion = competition.parameterConfigVersion;
  }

  if (data.name !== undefined) {
    parameter.name = data.name.trim();
  }
  if (data.description !== undefined) {
    parameter.description = data.description ? data.description.trim() : null;
  }
  if (data.guidelines !== undefined) {
    parameter.guidelines = data.guidelines ? data.guidelines.trim() : null;
  }
  if (data.maxMarks !== undefined) {
    parameter.maxMarks = data.maxMarks;
  }
  if (data.weightage !== undefined) {
    parameter.weightage = data.weightage;
  }
  if (data.applicableRounds !== undefined) {
    parameter.applicableRounds = data.applicableRounds;
  }
  if (data.isActive !== undefined) {
    parameter.isActive = data.isActive;
  }

  await parameter.save();
  return parameter;
}
