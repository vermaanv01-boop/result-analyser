import { Schema, type SchemaDefinition } from "mongoose";

export const ROUND_IDENTIFIERS = [1, 2] as const;
export type RoundIdentifier = (typeof ROUND_IDENTIFIERS)[number];

export interface RoundConfig {
  round: RoundIdentifier;
  status: "pending" | "active" | "closed";
  startedAt: Date | null;
}

export interface Method {
  method: string | null;
  parameters: Record<string, unknown>;
}

export interface Raw {
  rounds: RoundConfig[];
  applicableRounds: RoundIdentifier[];
  method: Method;
  count: number;
}

const roundSchema = new Schema(
  {
    round: {
      type: Number,
      enum: { values: ROUND_IDENTIFIERS, message: "round must be 1 or 2" },
      required: true,
    },
    status: {
      type: String,
      enum: { values: ["pending", "active", "closed"] as const, message: "bad" },
      required: true,
      default: "pending",
    },
    startedAt: { type: Date, default: null },
  },
  { _id: false, timestamps: false },
);

const methodSchema = new Schema(
  {
    method: { type: String, trim: true, default: null },
    parameters: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false, timestamps: false },
);

const def = {
  rounds: { type: [roundSchema], required: true, default: () => [] },
  applicableRounds: {
    type: [{ type: Number, enum: { values: ROUND_IDENTIFIERS, message: "m" } }],
    required: true,
    default: () => [],
  },
  method: { type: methodSchema, required: true },
  count: { type: Number, required: true, min: 1 },
} satisfies SchemaDefinition<Raw>;

const schema = new Schema<Raw>(def, { timestamps: true });
void schema;
