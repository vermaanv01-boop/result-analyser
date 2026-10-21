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
import { positiveNumberOrNullValidator } from "../utils/validation";
import type { UserDocument } from "./user.model";

export const COMPETITION_STATUSES = [
  "draft",
  "active",
  "completed",
  "archived",
] as const;

export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const ROUND_STATUSES = ["pending", "active", "closed"] as const;

export type RoundStatus = (typeof ROUND_STATUSES)[number];

export const SCORING_TOTAL_SOURCES = ["fixed", "derived"] as const;

export type ScoringTotalSource = (typeof SCORING_TOTAL_SOURCES)[number];

export interface CompetitionRound {
  round: RoundIdentifier;
  status: RoundStatus;
  startedAt: Date | null;
  closedAt: Date | null;
}

export interface ScoringStrategyConfig {
  method: string | null;
  parameters: Record<string, unknown>;
}

export interface CompetitionScoringPolicy {
  totalSource: ScoringTotalSource;
  fixedTotal: number | null;
  normalization: ScoringStrategyConfig;
  aggregation: ScoringStrategyConfig;
  weightage: ScoringStrategyConfig;
}

export interface Competition {
  name: string;
  description: string | null;
  status: CompetitionStatus;
  createdBy: Types.ObjectId;
  rounds: CompetitionRound[];
  scoringPolicy: CompetitionScoringPolicy;
  parameterConfigVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

function createDefaultRounds(): CompetitionRound[] {
  return ROUND_IDENTIFIERS.map((round) => ({
    round,
    status: "pending",
    startedAt: null,
    closedAt: null,
  }));
}

function createDefaultStrategyConfig(): ScoringStrategyConfig {
  return { method: null, parameters: {} };
}

function createDefaultScoringPolicy(): CompetitionScoringPolicy {
  return {
    totalSource: "derived",
    fixedTotal: null,
    normalization: createDefaultStrategyConfig(),
    aggregation: createDefaultStrategyConfig(),
    weightage: createDefaultStrategyConfig(),
  };
}

function validateRoundsConfiguration(value: CompetitionRound[]): boolean {
  if (!Array.isArray(value) || value.length !== ROUND_IDENTIFIERS.length) {
    return false;
  }

  const configured = new Set<RoundIdentifier>();

  for (const round of value) {
    if (!ROUND_IDENTIFIERS.includes(round.round)) {
      return false;
    }

    if (configured.has(round.round)) {
      return false;
    }

    configured.add(round.round);

    if (
      round.startedAt !== null &&
      round.closedAt !== null &&
      round.closedAt.getTime() < round.startedAt.getTime()
    ) {
      return false;
    }
  }

  return ROUND_IDENTIFIERS.every((round) => configured.has(round));
}

function validateRoundProgression(value: CompetitionRound[]): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  const first = value.find((round) => round.round === 1);
  const second = value.find((round) => round.round === 2);

  if (!first || !second) {
    return true;
  }

  if (
    first.status === "pending" &&
    (second.status === "active" || second.status === "closed")
  ) {
    return false;
  }

  return true;
}

function validateScoringPolicy(value: CompetitionScoringPolicy): boolean {
  if (!value) {
    return false;
  }

  if (value.totalSource === "fixed") {
    return (
      typeof value.fixedTotal === "number" &&
      Number.isFinite(value.fixedTotal) &&
      value.fixedTotal > 0
    );
  }

  return value.fixedTotal === null || value.fixedTotal === undefined;
}

const roundDefinition = {
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
      values: ROUND_STATUSES,
      message: "status must be one of: pending, active, closed",
    },
    required: [true, "status is required"],
    default: "pending",
  },
  startedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
} satisfies SchemaDefinition<CompetitionRound>;

const roundSchema = new Schema<CompetitionRound>(roundDefinition, {
  _id: false,
  timestamps: false,
});

const scoringStrategyDefinition = {
  method: {
    type: String,
    trim: true,
    maxlength: [100, "method must be at most 100 characters"],
    default: null,
  },
  parameters: {
    type: Schema.Types.Mixed,
    default: () => ({}),
  },
} satisfies SchemaDefinition<ScoringStrategyConfig>;

const scoringStrategySchema = new Schema<ScoringStrategyConfig>(
  scoringStrategyDefinition,
  { _id: false, timestamps: false },
);

const scoringPolicyDefinition = {
  totalSource: {
    type: String,
    enum: {
      values: SCORING_TOTAL_SOURCES,
      message: "totalSource must be one of: fixed, derived",
    },
    required: [true, "totalSource is required"],
    default: "derived",
  },
  fixedTotal: {
    type: Number,
    default: null,
    validate: positiveNumberOrNullValidator,
  },
  normalization: {
    type: scoringStrategySchema,
    required: [true, "normalization is required"],
    default: () => createDefaultStrategyConfig(),
  },
  aggregation: {
    type: scoringStrategySchema,
    required: [true, "aggregation is required"],
    default: () => createDefaultStrategyConfig(),
  },
  weightage: {
    type: scoringStrategySchema,
    required: [true, "weightage is required"],
    default: () => createDefaultStrategyConfig(),
  },
} satisfies SchemaDefinition<CompetitionScoringPolicy>;

const scoringPolicySchema = new Schema<CompetitionScoringPolicy>(
  scoringPolicyDefinition,
  { _id: false, timestamps: false },
);

const competitionDefinition = {
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
  status: {
    type: String,
    enum: {
      values: COMPETITION_STATUSES,
      message: "status must be one of: draft, active, completed, archived",
    },
    required: [true, "status is required"],
    default: "draft",
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User" satisfies ModelName,
    required: [true, "createdBy is required"],
  },
  rounds: {
    type: [roundSchema],
    required: [true, "rounds is required"],
    default: () => createDefaultRounds(),
  },
  scoringPolicy: {
    type: scoringPolicySchema,
    required: [true, "scoringPolicy is required"],
    default: () => createDefaultScoringPolicy(),
  },
  parameterConfigVersion: {
    type: Number,
    required: [true, "parameterConfigVersion is required"],
    default: 1,
    validate: {
      validator: (value: number): boolean =>
        Number.isInteger(value) && value > 0,
      message: "parameterConfigVersion must be a positive integer",
    },
  },
} satisfies SchemaDefinition<Competition>;

const competitionSchema = new Schema<Competition>(competitionDefinition, {
  timestamps: true,
});

competitionSchema
  .path("rounds")
  .validate(
    validateRoundsConfiguration,
    "rounds must configure exactly rounds 1 and 2 with unique identifiers",
  )
  .validate(
    validateRoundProgression,
    "rounds must not activate or close round 2 while round 1 is still pending",
  );

competitionSchema
  .path("scoringPolicy")
  .validate(
    validateScoringPolicy,
    "a fixed scoring total requires a positive fixedTotal and a derived scoring total must not define a fixedTotal",
  );

competitionSchema.index(
  { status: 1, createdAt: -1 },
  { name: "competition_status_createdAt" },
);

competitionSchema.index(
  { createdBy: 1, status: 1 },
  { name: "competition_createdBy_status" },
);

export type CompetitionDocument = HydratedDocument<Competition>;

export type PopulatedCompetition = Omit<CompetitionDocument, "createdBy"> & {
  createdBy: UserDocument;
};

export const Competition: Model<Competition> =
  (models.Competition as Model<Competition> | undefined) ??
  model<Competition>("Competition", competitionSchema);
