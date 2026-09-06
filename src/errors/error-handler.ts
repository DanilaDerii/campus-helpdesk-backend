import type { ErrorRequestHandler } from "express";
import { logEvent, safeErrorDetails } from "../logging/logger.js";
import { AuthenticationError } from "../services/auth.service.js";
import { CategoryServiceError } from "../services/category.service.js";
import { TicketServiceError } from "../services/ticket.service.js";
import { InvalidAccessTokenError } from "../services/token.service.js";
import { UserAdministrationError } from "../services/user.service.js";
import { HttpError } from "./http-error.js";

const ticketConflicts = new Set([
  "TICKET_ALREADY_ASSIGNED",
  "TICKET_NOT_CLAIMABLE",
  "INVALID_STATUS_TRANSITION",
  "TICKET_STATUS_CONFLICT",
  "INVALID_TECHNICIAN",
  "TICKET_ALREADY_RESOLVED",
]);

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred";

  if (error instanceof HttpError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  } else if (error instanceof InvalidAccessTokenError) {
    statusCode = 401;
    code = "INVALID_ACCESS_TOKEN";
    message = error.message;
  } else if (error instanceof AuthenticationError) {
    statusCode = error.code === "USER_INACTIVE"
      ? 403
      : error.code === "EXTERNAL_IDENTITY_CONFLICT" ? 409 : 401;
    code = error.code;
    message = error.message;
  } else if (error instanceof TicketServiceError) {
    statusCode = error.code.endsWith("FORBIDDEN")
      ? 403
      : ticketConflicts.has(error.code) ? 409 : 404;
    code = error.code;
    message = error.message;
  } else if (
    error instanceof CategoryServiceError || error instanceof UserAdministrationError
  ) {
    statusCode = error.code.endsWith("FORBIDDEN")
      ? 403
      : error.code.endsWith("NOT_FOUND") ? 404 : 409;
    code = error.code;
    message = error.message;
  }

  if (statusCode >= 500) {
    const cause = error instanceof Error ? error.cause ?? error : error;
    const { code: causeCode, ...details } = safeErrorDetails(cause);
    logEvent("error", "request_failed", {
      ...details,
      code,
      causeCode,
      operation: code.startsWith("MICROSOFT_") ? "microsoft_login" : "http_request",
      statusCode,
    });
  }

  response.status(statusCode).json({ error: code, message });
};
