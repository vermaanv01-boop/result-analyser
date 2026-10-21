import express, { type Express } from "express";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import healthRoutes from "./routes/health.routes";

export function createApp(): Express {
  const app: Express = express();

  app.use(corsMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/v1/health", healthRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
