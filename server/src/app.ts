import express, { type Express } from "express";
import healthRoutes from "./routes/health.routes";

export function createApp(): Express {
  const app: Express = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/v1/health", healthRoutes);

  return app;
}
