import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import { apiRoutes } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok", application: "campus-helpdesk" });
  });

  app.use(apiRoutes);

  app.use((_request, response) => {
    response.status(404).json({ error: "route_not_found" });
  });

  app.use(errorHandler);

  return app;
}
