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

export interface EvaluationParameter {
  competition: Types.ObjectId;
  name: string;
  description: string | null;
  guidelines: string | null;
  maxMarks: number;
  weightage: number;
  applicableRounds: RoundIdentifier[];
  isActive: boolean;
  configVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

function validateApplicableRounds(value: RoundIdentifier[]): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  const unique = new Set<RoundIdentifier>();

  for (const round of value) {
    if (!ROUND_IDENTIFIERS.includes(round)) {
      return false;
    }

    if (unique.has(round)) {
      return false;
    }

    unique.add(round);
  }

  return true;
}

const evaluationParameterDefinition = {
  competition: {
    type: Schema.Types.ObjectId,
    ref: "Competition" satisfies ModelName,
    required: [true, "competition is required"],
  },
  name: {
    type: String,
    required: [true, "name is required"],
    trim: true,
    minlength: [1, "name must not be empty"],
    maxlength: [200, "name must be at most 200 characters"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, "description must be at most 2000 characters"],
    default: null,
  },
  guidelines: {
    type: String,
    trim: true,
    maxlength: [5000, "guidelines must be at most 5000 characters"],
    default: null,
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
  isActive: {
    type: Boolean,
    required: [true, "isActive is required"],
    default: true,
  },
  configVersion: {
    type: Number,
    required: [true, "configVersion is required"],
    default: 1,
    validate: positiveIntegerValidator,
  },
} satisfies SchemaDefinition<EvaluationParameter>;

const evaluationParameterSchema = new Schema<EvaluationParameter>(
  evaluationParameterDefinition,
  { timestamps: true },
);

evaluationParameterSchema
  .path("applicableRounds")
  .validate(
    validateApplicableRounds,
    "applicableRounds must contain at least one round and no duplicate rounds",
  );

evaluationParameterSchema.index(
  { competition: 1, isActive: 1 },
  { name: "evaluationParameter_competition_isActive" },
);

evaluationParameterSchema.index(
  { competition: 1, name: 1 },
  { name: "evaluationParameter_competition_name" },
);

evaluationParameterSchema.index(
  { competition: 1, applicableRounds: 1 },
  { name: "evaluationParameter_competition_applicableRounds" },
);

export type EvaluationParameterDocument = HydratedDocument<EvaluationParameter>;

export const EvaluationParameter: Model<EvaluationParameter> =
  (models.EvaluationParameter as Model<EvaluationParameter> | undefined) ??
  model<EvaluationParameter>(
    "EvaluationParameter",
    evaluationParameterSchema,
  );
