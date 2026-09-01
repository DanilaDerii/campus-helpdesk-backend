import type { ErrorRequestHandler } from "express";
import { AuthenticationError } from "../services/auth.service.js";
import { CategoryServiceError } from "../services/category.service.js";
import { TicketServiceError } from "../services/ticket.service.js";
import { InvalidAccessTokenError } from "../services/token.service.js";
import { UserAdministrationError } from "../services/user.service.js";
import { HttpError } from "./http-error.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  if (error instanceof InvalidAccessTokenError) {
    response.status(401).json({
      error: "INVALID_ACCESS_TOKEN",
      message: error.message,
    });
    return;
  }

  if (error instanceof AuthenticationError) {
    const statusCode = error.code === "USER_INACTIVE" ? 403 : 401;

    response.status(statusCode).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  if (error instanceof TicketServiceError) {
    const conflictErrors = new Set([
      "TICKET_ALREADY_ASSIGNED",
      "TICKET_NOT_CLAIMABLE",
      "INVALID_STATUS_TRANSITION",
      "TICKET_STATUS_CONFLICT",
      "INVALID_TECHNICIAN",
      "TICKET_ALREADY_RESOLVED",
    ]);
    const statusCode = error.code.endsWith("FORBIDDEN")
      ? 403
      : conflictErrors.has(error.code)
        ? 409
        : 404;

    response.status(statusCode).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  if (error instanceof CategoryServiceError) {
    const statusCode = error.code.endsWith("FORBIDDEN")
      ? 403
      : error.code === "CATEGORY_NOT_FOUND"
        ? 404
        : 409;

    response.status(statusCode).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  if (error instanceof UserAdministrationError) {
    const statusCode = error.code.endsWith("FORBIDDEN")
      ? 403
      : error.code === "USER_NOT_FOUND"
        ? 404
        : 409;

    response.status(statusCode).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  });
};
