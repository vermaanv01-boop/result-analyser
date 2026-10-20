import type { Server } from "node:http";
import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
  } catch {
    console.error("[startup] Database connection failed. Aborting startup.");
    process.exit(1);
  }

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${env.PORT} is already in use.`);
    } else {
      console.error("Server failed to start:", error);
    }
    process.exit(1);
  });

  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`${signal} received. Shutting down...`);

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await disconnectDatabase();
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[shutdown] Graceful shutdown failed: ${message}`);
      process.exit(1);
    }
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap();
