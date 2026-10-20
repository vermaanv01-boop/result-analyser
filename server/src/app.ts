import express, { type Express } from "express";

export function createApp(): Express {
  const app: Express = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  return app;
}
