import mongoose from "mongoose";
import { env } from "./env";

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
    console.error(`[db] MongoDB connection error: ${error.message}`);
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

  connectionPromise = mongoose.connect(env.MONGODB_URI).catch((error: unknown) => {
    connectionPromise = null;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[db] Failed to connect to MongoDB: ${message}`);
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
