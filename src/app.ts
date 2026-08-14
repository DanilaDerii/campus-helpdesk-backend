import express, { type NextFunction, type Request, type Response } from "express";
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

  app.use(
    (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
      console.error(error);
      response.status(500).json({ error: "internal_server_error" });
    },
  );

  return app;
}
