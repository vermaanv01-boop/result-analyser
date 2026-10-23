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
  JWT_SECRET: isProduction
    ? z.string().min(32, "JWT_SECRET must be at least 32 characters in production")
    : z.string().min(8).default("venturecraft-secret-jwt-key-minimum-32-chars-long-development"),
  JWT_EXPIRES_IN: z.string().default("24h"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  EMAIL_DELIVERY_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
  EMAIL_DELIVERY_RETRY_DELAY_MS: z.coerce.number().int().min(100).max(60000).default(250),
  APP_PUBLIC_URL: z.string().default("http://localhost:5173"),
  JUDGE_ACTIVATION_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
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
