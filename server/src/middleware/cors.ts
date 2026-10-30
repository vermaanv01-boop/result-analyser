import cors, { type CorsOptions } from "cors";
import { env } from "../config/env";

const ALLOWED_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

const ALLOWED_HEADERS = ["Content-Type", "Authorization"];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      LOOPBACK_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
}

const KNOWN_ALLOWED_ORIGINS = new Set([
  "https://venture-craft-leaderboard.netlify.app",
]);

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

function isAllowedOrigin(origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  if (normalized === normalizeOrigin(env.CLIENT_ORIGIN)) {
    return true;
  }

  if (KNOWN_ALLOWED_ORIGINS.has(normalized)) {
    return true;
  }

  if (env.NODE_ENV !== "production" && isLoopbackOrigin(origin)) {
    return true;
  }

  return false;
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  methods: ALLOWED_METHODS,
  allowedHeaders: ALLOWED_HEADERS,
  credentials: false,
  optionsSuccessStatus: 204,
  maxAge: 600,
};

export const corsMiddleware = cors(corsOptions);
