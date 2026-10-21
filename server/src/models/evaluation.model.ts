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
    validate: nonNegativeNumberValidator,
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
  },
  criteria: {
    type: [criterionSchema],
    required: [true, "criteria is required"],
  },
  parameterConfigVersion: {
    type: Number,
    required: [true, "parameterConfigVersion is required"],
    validate: positiveIntegerValidator,
  },
  submittedAt: {
    type: Date,
    default: null,
  },
} satisfies SchemaDefinition<Evaluation>;

const evaluationSchema = new Schema<Evaluation>(evaluationDefinition, {
  timestamps: true,
});

evaluationSchema.pre("validate", function () {
  const criteria = this.criteria;
  const seenParameters = new Set<string>();

  criteria.forEach((criterion, index) => {
    const key = criterion.parameter.toString();

    if (seenParameters.has(key)) {
      this.invalidate(
        `criteria.${index}.parameter`,
        "criteria must not contain more than one entry per parameter",
      );
    }

    seenParameters.add(key);

    if (!criterion.applicableRounds.includes(this.round)) {
      this.invalidate(
        `criteria.${index}.applicableRounds`,
        "the evaluated parameter must apply to the evaluated round",
      );
    }

    if (criterion.awardedMarks > criterion.maxMarks) {
      this.invalidate(
        `criteria.${index}.awardedMarks`,
        "awardedMarks must not exceed the maximum marks of the evaluated parameter",
      );
    }
  });

  if (criteria.length === 0) {
    this.invalidate("criteria", "criteria must contain at least one criterion");
  }

  if (this.status === "submitted") {
    if (this.submittedAt == null) {
      this.invalidate(
        "submittedAt",
        "submittedAt is required when the evaluation is submitted",
      );
    }
  }
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

evaluationSchema.index(
  { competition: 1, round: 1, status: 1 },
  { name: "evaluation_competition_round_status" },
);

evaluationSchema.index(
  { panel: 1, round: 1, status: 1 },
  { name: "evaluation_panel_round_status" },
);

export type EvaluationDocument = HydratedDocument<Evaluation>;

export const Evaluation: Model<Evaluation> =
  (models.Evaluation as Model<Evaluation> | undefined) ??
  model<Evaluation>("Evaluation", evaluationSchema);
