import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
  type SchemaDefinition,
  type Types,
} from "mongoose";
import {
  ROUND_IDENTIFIERS,
  type ModelName,
  type RoundIdentifier,
} from "../types/domain.types";
import {
  nonNegativeNumberValidator,
  positiveIntegerValidator,
  positiveNumberValidator,
} from "../utils/validation";

export const EVALUATION_STATUSES = ["draft", "submitted"] as const;

export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export interface EvaluationCriterion {
  parameter: Types.ObjectId;
  configVersion: number;
  parameterName: string;
  maxMarks: number;
  weightage: number;
  applicableRounds: RoundIdentifier[];
  awardedMarks: number;
}

export interface Evaluation {
  competition: Types.ObjectId;
  participant: Types.ObjectId;
  panel: Types.ObjectId;
  judge: Types.ObjectId;
  round: RoundIdentifier;
  status: EvaluationStatus;
  criteria: EvaluationCriterion[];
  parameterConfigVersion: number;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function validateAwardedMarks(
  this: EvaluationCriterion,
  value: number,
): boolean {
  if (!Number.isFinite(value) || value < 0) {
    return false;
  }

  const maxMarks = this.maxMarks;

  if (typeof maxMarks !== "number" || !Number.isFinite(maxMarks)) {
    return true;
  }

  return value <= maxMarks;
}

function validateCriteria(this: Evaluation, value: EvaluationCriterion[]): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  const parameters = new Set<string>();

  for (const criterion of value) {
    const key = criterion.parameter.toString();

    if (parameters.has(key)) {
      return false;
    }

    parameters.add(key);

    if (!Array.isArray(criterion.applicableRounds)) {
      return false;
    }

    if (!criterion.applicableRounds.includes(this.round)) {
      return false;
    }
  }

  return true;
}

function validateStatus(this: Evaluation, value: EvaluationStatus): boolean {
  if (value !== "submitted") {
    return true;
  }

  if (this.submittedAt === null || this.submittedAt === undefined) {
    return false;
  }

  return Array.isArray(this.criteria) && this.criteria.length > 0;
}

function validateSubmittedAt(this: Evaluation, value: Date | null): boolean {
  if (this.status !== "submitted") {
    return true;
  }

  return value !== null && value !== undefined;
}

const criterionDefinition = {
  parameter: {
    type: Schema.Types.ObjectId,
    ref: "EvaluationParameter" satisfies ModelName,
    required: [true, "parameter is required"],
  },
  configVersion: {
    type: Number,
    required: [true, "configVersion is required"],
    validate: positiveIntegerValidator,
  },
  parameterName: {
    type: String,
    required: [true, "parameterName is required"],
    trim: true,
    minlength: [1, "parameterName must not be empty"],
    maxlength: [200, "parameterName must be at most 200 characters"],
  },
  maxMarks: {
    type: Number,
    required: [true, "maxMarks is required"],
    validate: positiveNumberValidator,
  },
  weightage: {
    type: Number,
    required: [true, "weightage is required"],
    validate: nonNegativeNumberValidator,
  },
  applicableRounds: {
    type: [{ type: Number, enum: { values: ROUND_IDENTIFIERS } }],
    required: [true, "applicableRounds is required"],
  },
  awardedMarks: {
    type: Number,
    required: [true, "awardedMarks is required"],
    validate: validateAwardedMarks,
  },
} satisfies SchemaDefinition<EvaluationCriterion>;

const criterionSchema = new Schema<EvaluationCriterion>(criterionDefinition, {
  _id: false,
  timestamps: false,
});

const evaluationDefinition = {
  competition: {
    type: Schema.Types.ObjectId,
    ref: "Competition" satisfies ModelName,
    required: [true, "competition is required"],
  },
  participant: {
    type: Schema.Types.ObjectId,
    ref: "Participant" satisfies ModelName,
    required: [true, "participant is required"],
  },
  panel: {
    type: Schema.Types.ObjectId,
    ref: "Panel" satisfies ModelName,
    required: [true, "panel is required"],
  },
  judge: {
    type: Schema.Types.ObjectId,
    ref: "User" satisfies ModelName,
    required: [true, "judge is required"],
  },
  round: {
    type: Number,
    enum: {
      values: ROUND_IDENTIFIERS,
      message: "round must be one of: 1, 2",
    },
    required: [true, "round is required"],
  },
  status: {
    type: String,
    enum: {
      values: EVALUATION_STATUSES,
      message: "status must be one of: draft, submitted",
    },
    required: [true, "status is required"],
    default: "draft",
    validate: validateStatus,
  },
  criteria: {
    type: [criterionSchema],
    required: [true, "criteria is required"],
    validate: validateCriteria,
  },
  parameterConfigVersion: {
    type: Number,
    required: [true, "parameterConfigVersion is required"],
    validate: positiveIntegerValidator,
  },
  submittedAt: {
    type: Date,
    default: null,
    validate: validateSubmittedAt,
  },
} satisfies SchemaDefinition<Evaluation>;

const evaluationSchema = new Schema<Evaluation>(evaluationDefinition, {
  timestamps: true,
});

evaluationSchema.index(
  { competition: 1, participant: 1, round: 1, judge: 1 },
  { name: "evaluation_logical_submission", unique: true },
);

evaluationSchema.index(
  { participant: 1, round: 1 },
  { name: "evaluation_participant_round" },
);

evaluationSchema.index(
  { judge: 1, round: 1 },
  { name: "evaluation_judge_round" },
);

evaluationSchema.index(
  { competition: 1, round: 1 },
  { name: "evaluation_competition_round" },
);

evaluationSchema.index(
  { panel: 1, round: 1 },
  { name: "evaluation_panel_round" },
);

export type EvaluationDocument = HydratedDocument<Evaluation>;

export const Evaluation: Model<Evaluation> =
  (models.Evaluation as Model<Evaluation> | undefined) ??
  model<Evaluation>("Evaluation", evaluationSchema);
