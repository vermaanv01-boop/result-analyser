import "dotenv/config";
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: isProduction
    ? z.string().min(1, "MONGODB_URI is required in production")
    : z.string().min(1).default("mongodb://localhost:27017/student_ranking"),
  CLIENT_ORIGIN: z.url().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = Object.freeze(parsed.data);

export type Env = typeof env;
