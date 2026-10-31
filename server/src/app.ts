import express, { type Express, type RequestHandler } from "express";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import authRoutes from "./routes/auth.routes";
import competitionRoutes from "./routes/competition.routes";
import evaluationRoutes from "./routes/evaluation.routes";
import healthRoutes from "./routes/health.routes";
import judgeRoutes from "./routes/judge.routes";
import portalRoutes from "./routes/portal.routes";

export interface CreateAppOptions {
  beforeRoutes?: RequestHandler[];
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app: Express = express();

  app.use(corsMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  for (const middleware of options.beforeRoutes ?? []) {
    app.use(middleware);
  }

  app.use("/api/v1/health", healthRoutes);
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/competitions", competitionRoutes);
  app.use("/api/v1/evaluations", evaluationRoutes);
  app.use("/api/v1/judge", judgeRoutes);
  app.use("/api/v1/portal", portalRoutes);
  // Backward-compatible alias for clients using the participant-prefixed path
  app.use("/api/v1/participant", portalRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
