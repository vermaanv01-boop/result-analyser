import { Competition } from "../models/competition.model";
import {
  Evaluation,
  type EvaluationDocument,
} from "../models/evaluation.model";
import {
  EvaluationParameter,
  type EvaluationParameterDocument,
} from "../models/evaluation-parameter.model";
import { Participant } from "../models/participant.model";
import type { RoundIdentifier } from "../types/domain.types";
import { ApiError } from "../utils/api-error";

export interface ParameterViewInput {
  id: string;
  name: string;
  maxMarks: number;
  weightage: number;
  applicableRounds: RoundIdentifier[];
  isActive: boolean;
  configVersion: number;
  priority: number | null;
}

export interface CriterionScoreInput {
  parameterId: string;
  parameterName: string;
  maxMarks: number;
  weightage: number;
  applicableRounds: RoundIdentifier[];
  configVersion: number;
  awardedMarks: number;
}

export interface EvaluationViewInput {
  id: string;
  judgeId: string | null;
  judgeName: string;
  judgeEmail: string | null;
  round: RoundIdentifier;
  status: "draft" | "submitted";
  submittedAt: string | null;
  updatedAt: string | null;
  criteria: CriterionScoreInput[];
}

export interface RoundViewInput {
  round: RoundIdentifier;
  status: "pending" | "active" | "closed";
}

export interface ParticipantViewInput {
  id: string;
  name: string;
  registrationId: string;
  panelId: string | null;
  panelName: string | null;
}

export interface ConfiguredCriterionView {
  parameterId: string;
  parameterName: string;
  maxMarks: number;
  weightage: number;
  applicableRounds: RoundIdentifier[];
  isActive: boolean;
  configVersion: number;
  priority: number | null;
}

export interface CriterionMarkView {
  parameterId: string;
  parameterName: string;
  maxMarks: number;
  weightage: number;
  awardedMarks: number | null;
  isEvaluated: boolean;
  configVersion: number | null;
  source: "configured" | "snapshot";
}

export interface EvaluationMarksView {
  evaluationId: string;
  judgeId: string | null;
  judgeName: string;
  judgeEmail: string | null;
  status: "draft" | "submitted";
  submittedAt: string | null;
  updatedAt: string | null;
  criteria: CriterionMarkView[];
  recordedTotalMarks: number;
  maxPossibleMarks: number;
  missingCriterionCount: number;
  isComplete: boolean;
}

export interface RoundEvaluationView {
  round: RoundIdentifier;
  roundStatus: "pending" | "active" | "closed";
  configuredCriteria: ConfiguredCriterionView[];
  evaluations: EvaluationMarksView[];
  submittedEvaluationCount: number;
  draftEvaluationCount: number;
  status: "unevaluated" | "draft_only" | "in_progress" | "complete";
  submittedTotalMarks: number | null;
  maxPossibleMarks: number;
}

export interface ParticipantEvaluationDetailsView {
  participant: ParticipantViewInput;
  rounds: RoundEvaluationView[];
  overall: {
    submittedTotalMarks: number | null;
    maxPossibleMarks: number;
    evaluatedRounds: RoundIdentifier[];
  };
}

function sortParameters(
  parameters: ParameterViewInput[],
): ParameterViewInput[] {
  return [...parameters].sort((a, b) => {
    const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
    const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.name.localeCompare(b.name);
  });
}

function buildCriterionRows(
  round: RoundIdentifier,
  configuredParameters: ParameterViewInput[],
  evaluation: EvaluationViewInput,
): CriterionMarkView[] {
  const rows: CriterionMarkView[] = [];
  const recordedByParameter = new Map(
    evaluation.criteria.map((criterion) => [criterion.parameterId, criterion]),
  );

  for (const parameter of configuredParameters) {
    const recorded = recordedByParameter.get(parameter.id);
    recordedByParameter.delete(parameter.id);

    if (recorded) {
      rows.push({
        parameterId: parameter.id,
        parameterName: recorded.parameterName,
        maxMarks: recorded.maxMarks,
        weightage: recorded.weightage,
        awardedMarks: recorded.awardedMarks,
        isEvaluated: true,
        configVersion: recorded.configVersion,
        source: "configured",
      });
    } else {
      rows.push({
        parameterId: parameter.id,
        parameterName: parameter.name,
        maxMarks: parameter.maxMarks,
        weightage: parameter.weightage,
        awardedMarks: null,
        isEvaluated: false,
        configVersion: parameter.configVersion,
        source: "configured",
      });
    }
  }

  for (const recorded of evaluation.criteria) {
    if (!recordedByParameter.has(recorded.parameterId)) {
      continue;
    }
    rows.push({
      parameterId: recorded.parameterId,
      parameterName: recorded.parameterName,
      maxMarks: recorded.maxMarks,
      weightage: recorded.weightage,
      awardedMarks: recorded.awardedMarks,
      isEvaluated: true,
      configVersion: recorded.configVersion,
      source: "snapshot",
    });
  }

  return rows;
}

function buildEvaluationMarks(
  round: RoundIdentifier,
  configuredParameters: ParameterViewInput[],
  evaluation: EvaluationViewInput,
): EvaluationMarksView {
  const criteria = buildCriterionRows(round, configuredParameters, evaluation);
  const recordedTotalMarks = criteria.reduce(
    (total, criterion) => total + (criterion.awardedMarks ?? 0),
    0,
  );
  const maxPossibleMarks = criteria.reduce(
    (total, criterion) => total + criterion.maxMarks,
    0,
  );
  const missingCriterionCount = criteria.filter(
    (criterion) => !criterion.isEvaluated,
  ).length;

  return {
    evaluationId: evaluation.id,
    judgeId: evaluation.judgeId,
    judgeName: evaluation.judgeName,
    judgeEmail: evaluation.judgeEmail,
    status: evaluation.status,
    submittedAt: evaluation.submittedAt,
    updatedAt: evaluation.updatedAt,
    criteria,
    recordedTotalMarks: Number(recordedTotalMarks.toFixed(4)),
    maxPossibleMarks: Number(maxPossibleMarks.toFixed(4)),
    missingCriterionCount,
    isComplete: criteria.length > 0 && missingCriterionCount === 0,
  };
}

export function buildParticipantEvaluationDetails(
  participant: ParticipantViewInput,
  rounds: RoundViewInput[],
  parameters: ParameterViewInput[],
  evaluations: EvaluationViewInput[],
): ParticipantEvaluationDetailsView {
  const sortedParameters = sortParameters(parameters);

  const roundViews = rounds.map((roundEntry): RoundEvaluationView => {
    const configuredParameters = sortedParameters.filter((parameter) =>
      parameter.applicableRounds.includes(roundEntry.round),
    );
    const roundEvaluations = evaluations
      .filter((evaluation) => evaluation.round === roundEntry.round)
      .map((evaluation) =>
        buildEvaluationMarks(
          roundEntry.round,
          configuredParameters,
          evaluation,
        ),
      );

    const submitted = roundEvaluations.filter(
      (evaluation) => evaluation.status === "submitted",
    );
    const drafts = roundEvaluations.filter(
      (evaluation) => evaluation.status === "draft",
    );

    let status: RoundEvaluationView["status"] = "unevaluated";
    if (submitted.length > 0) {
      status =
        drafts.length === 0 && submitted.every((evaluation) => evaluation.isComplete)
          ? "complete"
          : "in_progress";
    } else if (drafts.length > 0) {
      status = "draft_only";
    }

    let submittedTotalMarks: number | null = null;
    let maxPossibleMarks = 0;
    if (submitted.length > 0) {
      const total = submitted.reduce(
        (sum, evaluation) => sum + evaluation.recordedTotalMarks,
        0,
      );
      submittedTotalMarks = Number((total / submitted.length).toFixed(4));
      maxPossibleMarks = Math.max(
        ...submitted.map((evaluation) => evaluation.maxPossibleMarks),
      );
    }

    return {
      round: roundEntry.round,
      roundStatus: roundEntry.status,
      configuredCriteria: configuredParameters.map((parameter) => ({
        parameterId: parameter.id,
        parameterName: parameter.name,
        maxMarks: parameter.maxMarks,
        weightage: parameter.weightage,
        applicableRounds: parameter.applicableRounds,
        isActive: parameter.isActive,
        configVersion: parameter.configVersion,
        priority: parameter.priority,
      })),
      evaluations: roundEvaluations,
      submittedEvaluationCount: submitted.length,
      draftEvaluationCount: drafts.length,
      status,
      submittedTotalMarks,
      maxPossibleMarks: Number(maxPossibleMarks.toFixed(4)),
    };
  });

  const evaluatedRounds = roundViews
    .filter((round) => round.submittedTotalMarks !== null)
    .map((round) => round.round);
  const submittedTotalMarks =
    evaluatedRounds.length > 0
      ? Number(
          roundViews
            .reduce(
              (total, round) => total + (round.submittedTotalMarks ?? 0),
              0,
            )
            .toFixed(4),
        )
      : null;
  const maxPossibleMarks = Number(
    roundViews
      .reduce((total, round) => total + round.maxPossibleMarks, 0)
      .toFixed(4),
  );

  return {
    participant,
    rounds: roundViews,
    overall: {
      submittedTotalMarks,
      maxPossibleMarks,
      evaluatedRounds,
    },
  };
}

function getReferencedId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    if ("_id" in value) {
      const id = (value as { _id?: { toString(): string } })._id;
      if (id) {
        return id.toString();
      }
    }
    return String(value);
  }
  return String(value);
}

function mapEvaluation(evaluation: EvaluationDocument): EvaluationViewInput {
  const judge =
    typeof evaluation.judge === "object" && evaluation.judge !== null
      ? (evaluation.judge as unknown as {
          _id: { toString(): string };
          name?: string;
          email?: string;
        })
      : null;

  return {
    id: evaluation._id.toString(),
    judgeId: judge ? judge._id.toString() : String(evaluation.judge),
    judgeName: judge?.name ?? "Unknown judge",
    judgeEmail: judge?.email ?? null,
    round: evaluation.round,
    status: evaluation.status,
    submittedAt: evaluation.submittedAt
      ? evaluation.submittedAt.toISOString()
      : null,
    updatedAt: evaluation.updatedAt.toISOString(),
    criteria: evaluation.criteria.map((criterion) => ({
      parameterId: criterion.parameter.toString(),
      parameterName: criterion.parameterName,
      maxMarks: criterion.maxMarks,
      weightage: criterion.weightage,
      applicableRounds: criterion.applicableRounds,
      configVersion: criterion.configVersion,
      awardedMarks: criterion.awardedMarks,
    })),
  };
}

function mapParameter(parameter: EvaluationParameterDocument): ParameterViewInput {
  return {
    id: parameter._id.toString(),
    name: parameter.name,
    maxMarks: parameter.maxMarks,
    weightage: parameter.weightage,
    applicableRounds: parameter.applicableRounds,
    isActive: parameter.isActive,
    configVersion: parameter.configVersion,
    priority: parameter.priority ?? null,
  };
}

export async function getParticipantEvaluationDetails(
  participantId: string,
): Promise<ParticipantEvaluationDetailsView> {
  const participant = await Participant.findById(participantId).populate(
    "panel",
    "name",
  );

  if (!participant) {
    throw ApiError.notFound("Participant not found");
  }

  const competition = await Competition.findById(participant.competition);
  if (!competition) {
    throw ApiError.notFound("Competition not found for this participant");
  }

  const [parameters, evaluations] = await Promise.all([
    EvaluationParameter.find({ competition: competition._id }),
    Evaluation.find({ participant: participant._id })
      .populate("judge", "name email")
      .sort({ round: 1, submittedAt: 1, updatedAt: 1 }),
  ]);

  const panel =
    typeof participant.panel === "object" && participant.panel !== null
      ? (participant.panel as unknown as {
          _id: { toString(): string };
          name?: string;
        })
      : null;

  return buildParticipantEvaluationDetails(
    {
      id: participant._id.toString(),
      name: participant.name,
      registrationId: participant.registrationId,
      panelId: getReferencedId(participant.panel),
      panelName: panel?.name ?? null,
    },
    competition.rounds.map((round) => ({
      round: round.round,
      status: round.status,
    })),
    parameters.map(mapParameter),
    evaluations.map(mapEvaluation),
  );
}
