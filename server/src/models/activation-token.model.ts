import crypto from "crypto";
import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";
import { nonNegativeNumberValidator } from "../utils/validation";

export interface ActivationToken {
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const activationTokenSchema = new Schema<ActivationToken>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "user is required"],
      index: true,
    },
    tokenHash: {
      type: String,
      required: [true, "tokenHash is required"],
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: [true, "expiresAt is required"],
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

activationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ActivationTokenDocument = HydratedDocument<ActivationToken>;

export const ActivationToken: Model<ActivationToken> =
  (models.ActivationToken as Model<ActivationToken> | undefined) ??
  model<ActivationToken>("ActivationToken", activationTokenSchema);

export function generateActivationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashActivationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
