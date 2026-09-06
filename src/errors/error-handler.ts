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
  "TICKET_ASSIGNMENT_CONFLICT",
]);

function readStringProperty(error: object, property: string): string | undefined {
  if (!(property in error)) return undefined;
  const value = (error as Record<string, unknown>)[property];
  return typeof value === "string" ? value : undefined;
}

function readNumberProperty(error: object, property: string): number | undefined {
  if (!(property in error)) return undefined;
  const value = (error as Record<string, unknown>)[property];
  return typeof value === "number" ? value : undefined;
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred";

  const bodyErrorType = typeof error === "object" && error !== null
    ? readStringProperty(error, "type") : undefined;
  const bodyErrorStatus = typeof error === "object" && error !== null
    ? readNumberProperty(error, "status") ??
      readNumberProperty(error, "statusCode")
    : undefined;
  const databaseErrorCode = typeof error === "object" && error !== null
    ? readStringProperty(error, "code") : undefined;

  if (bodyErrorType === "entity.parse.failed" && bodyErrorStatus === 400) {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "The request body contains invalid JSON";
  } else if (bodyErrorType === "entity.too.large" && bodyErrorStatus === 413) {
    statusCode = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "The JSON request body must not exceed 100 KB";
  } else if (error instanceof HttpError) {
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
  } else if (databaseErrorCode === "P2002") {
    statusCode = 409;
    code = "DATABASE_CONFLICT";
    message = "A record with these values already exists";
  } else if (databaseErrorCode === "P2003") {
    statusCode = 409;
    code = "RELATED_RECORD_CONFLICT";
    message = "A related record prevents this operation";
  } else if (databaseErrorCode === "P2025") {
    statusCode = 404;
    code = "RESOURCE_NOT_FOUND";
    message = "The requested record no longer exists";
  } else if (databaseErrorCode === "P2034") {
    statusCode = 409;
    code = "CONCURRENT_UPDATE";
    message = "The record changed during this request; reload and try again";
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
