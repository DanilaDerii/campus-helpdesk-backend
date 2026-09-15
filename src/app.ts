import express from "express";
import { checkDatabaseReadiness } from "./data_access/prisma.js";
import { errorHandler, HttpError } from "./api/guardrails/errors.js";
import { apiRoutes } from "./api/index.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(express.json({ limit: "100kb", strict: true }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok", application: "campus-helpdesk" });
  });

  app.get("/ready", async (_request, response) => {
    try {
      await checkDatabaseReadiness();
      response.status(200).json({ status: "ready", database: "available" });
    } catch (error: unknown) {
      throw new HttpError(
        503,
        "DATABASE_UNAVAILABLE",
        "The database is not ready",
        { cause: error },
      );
    }
  });

  app.use(apiRoutes);

  app.use((_request, response) => {
    response.status(404).json({ error: "route_not_found" });
  });

  app.use(errorHandler);

  return app;
}
