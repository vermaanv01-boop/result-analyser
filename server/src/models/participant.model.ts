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

export interface ParticipantEligibility {
  round: RoundIdentifier;
  eligible: boolean;
  ineligibleReason: string | null;
  updatedAt: Date;
}

export interface Participant {
  competition: Types.ObjectId;
  name: string;
  registrationId: string;
  email: string | null;
  panel: Types.ObjectId | null;
  isActive: boolean;
  eligibility: ParticipantEligibility[];
  createdAt: Date;
  updatedAt: Date;
}

function createDefaultEligibility(): ParticipantEligibility[] {
  return ROUND_IDENTIFIERS.map((round) => ({
    round,
    eligible: true,
    ineligibleReason: null,
    updatedAt: new Date(),
  }));
}

function validateEligibility(
  this: Participant,
  value: ParticipantEligibility[],
): boolean {
  if (!Array.isArray(value) || value.length !== ROUND_IDENTIFIERS.length) {
    return false;
  }

  const covered = new Set<RoundIdentifier>();

  for (const entry of value) {
    if (!ROUND_IDENTIFIERS.includes(entry.round)) {
      return false;
    }

    if (covered.has(entry.round)) {
      return false;
    }

    covered.add(entry.round);

    if (!entry.eligible && !entry.ineligibleReason) {
      return false;
    }
  }

  return ROUND_IDENTIFIERS.every((round) => covered.has(round));
}

const eligibilityDefinition = {
  round: {
    type: Number,
    enum: {
      values: ROUND_IDENTIFIERS,
      message: "round must be one of: 1, 2",
    },
    required: [true, "round is required"],
  },
  eligible: {
    type: Boolean,
    required: [true, "eligible is required"],
  },
  ineligibleReason: {
    type: String,
    trim: true,
    maxlength: [500, "ineligibleReason must be at most 500 characters"],
    default: null,
  },
  updatedAt: {
    type: Date,
    required: [true, "updatedAt is required"],
    default: () => new Date(),
  },
} satisfies SchemaDefinition<ParticipantEligibility>;

const eligibilitySchema = new Schema<ParticipantEligibility>(
  eligibilityDefinition,
  { _id: false, timestamps: false },
);

const participantDefinition = {
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
  registrationId: {
    type: String,
    required: [true, "registrationId is required"],
    trim: true,
    uppercase: true,
    minlength: [1, "registrationId must not be empty"],
    maxlength: [64, "registrationId must be at most 64 characters"],
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "email must be a valid email address"],
    default: null,
  },
  panel: {
    type: Schema.Types.ObjectId,
    ref: "Panel" satisfies ModelName,
    default: null,
  },
  isActive: {
    type: Boolean,
    required: [true, "isActive is required"],
    default: true,
  },
  eligibility: {
    type: [eligibilitySchema],
    required: [true, "eligibility is required"],
    default: () => createDefaultEligibility(),
    validate: validateEligibility,
  },
} satisfies SchemaDefinition<Participant>;

const participantSchema = new Schema<Participant>(participantDefinition, {
  timestamps: true,
});

participantSchema.index(
  { competition: 1, registrationId: 1 },
  { name: "participant_competition_registrationId", unique: true },
);

participantSchema.index(
  { competition: 1, isActive: 1 },
  { name: "participant_competition_isActive" },
);

participantSchema.index(
  { panel: 1, isActive: 1 },
  { name: "participant_panel_isActive" },
);

export type ParticipantDocument = HydratedDocument<Participant>;

export const Participant: Model<Participant> =
  (models.Participant as Model<Participant> | undefined) ??
  model<Participant>("Participant", participantSchema);
