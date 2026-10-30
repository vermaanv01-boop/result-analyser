import dns from "dns";
import mongoose from "mongoose";
import { describeError } from "../utils/safe-log";
import { env } from "./env";

// In serverless / cloud container environments (e.g. AWS Lambda / Vercel),
// default container DNS can fail or timeout when resolving mongodb+srv DNS SRV records.
// Explicitly configure public resolvers.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // If platform prevents setServers, continue with default resolvers
}

const CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  bufferCommands: false,
  maxPoolSize: 10,
  minPoolSize: 0,
} as const;

const CONNECTION_STATES: Record<string, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
  uninitialized: "uninitialized",
};

let connectionPromise: Promise<typeof mongoose> | null = null;
let listenersAttached = false;

function describeConnectionString(): string {
  try {
    const url = new URL(env.MONGODB_URI);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return "<unparseable>";
  }
}

function attachConnectionListeners(): void {
  if (listenersAttached) {
    return;
  }
  listenersAttached = true;

  const connection = mongoose.connection;

  connection.on("connected", () => {
    console.log(`[db] MongoDB connected (${describeConnectionString()})`);
  });

  connection.on("disconnected", () => {
    const state = CONNECTION_STATES[connection.readyState] ?? "unknown";
    console.warn(`[db] MongoDB disconnected (state: ${state})`);
  });

  connection.on("reconnected", () => {
    console.log("[db] MongoDB connection reestablished");
  });

  connection.on("error", (error: Error) => {
    console.error(`[db] MongoDB connection error: ${describeError(error)}`);
  });
}

export function getDatabaseState(): string {
  return CONNECTION_STATES[mongoose.connection.readyState] ?? "unknown";
}

export function connectDatabase(): Promise<typeof mongoose> {
  if (connectionPromise) {
    return connectionPromise;
  }

  attachConnectionListeners();

  console.log(`[db] Connecting to MongoDB (${describeConnectionString()})`);

  connectionPromise = mongoose
    .connect(env.MONGODB_URI, CONNECTION_OPTIONS)
    .catch((error: unknown) => {
      connectionPromise = null;
      console.error(`[db] Failed to connect to MongoDB: ${describeError(error)}`);
      throw error;
    });

  return connectionPromise;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    connectionPromise = null;
    return;
  }
  await mongoose.disconnect();
  connectionPromise = null;
  console.log("[db] MongoDB connection closed");
}
