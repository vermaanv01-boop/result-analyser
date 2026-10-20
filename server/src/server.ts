import "dotenv/config";
import type { Server } from "node:http";
import { createApp } from "./app";

const PORT: number = Number(process.env.PORT ?? 3000);

const app = createApp();

const server: Server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error("Server failed to start:", error);
  }
  process.exit(1);
});

function shutdown(signal: string): void {
  console.log(`${signal} received. Closing server...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
