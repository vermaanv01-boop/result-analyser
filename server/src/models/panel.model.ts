import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
  type SchemaDefinition,
  type Types,
} from "mongoose";
import type { ModelName } from "../types/domain.types";

export interface Panel {
  competition: Types.ObjectId;
  name: string;
  description: string | null;
  judges: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function validateJudges(this: Panel, value: Types.ObjectId[]): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  const unique = new Set(value.map((judge) => judge.toString()));

  return unique.size === value.length;
}

const panelDefinition = {
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
  judges: {
    type: [{ type: Schema.Types.ObjectId, ref: "User" satisfies ModelName }],
    required: [true, "judges is required"],
    validate: validateJudges,
  },
  isActive: {
    type: Boolean,
    required: [true, "isActive is required"],
    default: true,
  },
} satisfies SchemaDefinition<Panel>;

const panelSchema = new Schema<Panel>(panelDefinition, {
  timestamps: true,
});

panelSchema.index(
  { competition: 1, name: 1 },
  { name: "panel_competition_name" },
);

panelSchema.index(
  { competition: 1, isActive: 1 },
  { name: "panel_competition_isActive" },
);

panelSchema.index({ judges: 1 }, { name: "panel_judges" });

export type PanelDocument = HydratedDocument<Panel>;

export const Panel: Model<Panel> =
  (models.Panel as Model<Panel> | undefined) ??
  model<Panel>("Panel", panelSchema);
