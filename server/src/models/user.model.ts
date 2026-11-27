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

export const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

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
    loginId: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        LOGIN_ID_PATTERN,
        "loginId must be 3-32 characters and use only letters, numbers, dot, underscore, or hyphen",
      ],
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

userSchema.index(
  { loginId: 1 },
  { name: "user_loginId_unique", unique: true, sparse: true },
);

export type User = InferSchemaType<typeof userSchema>;

export type UserDocument = HydratedDocument<User>;

export const User: Model<User> =
  (models.User as Model<User> | undefined) ?? model<User>("User", userSchema);
