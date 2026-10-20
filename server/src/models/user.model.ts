import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const USER_ROLES = ["admin", "judge", "participant"] as const;

export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "email must be a valid email address"],
    },
    passwordHash: {
      type: String,
      required: [true, "passwordHash is required"],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: "role must be one of: admin, judge, participant",
      },
      required: [true, "role is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export type User = InferSchemaType<typeof userSchema>;

export type UserDocument = HydratedDocument<User>;

export const User: Model<User> =
  (models.User as Model<User> | undefined) ?? model<User>("User", userSchema);
