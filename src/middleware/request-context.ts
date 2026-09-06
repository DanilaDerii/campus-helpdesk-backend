import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { requestLogContext } from "../logging/logger.js";

export const requestContext: RequestHandler = (_request, response, next) => {
  const requestId = randomUUID();
  response.setHeader("X-Request-Id", requestId);
  requestLogContext.run({ requestId }, next);
};
