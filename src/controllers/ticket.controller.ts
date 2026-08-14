import type { RequestHandler } from "express";
import { TicketPriority } from "../generated/prisma/client.js";
import {
  createTicket,
  getTicketForUser,
  listTicketsForUser,
} from "../services/ticket.service.js";
import { HttpError } from "../shared/http-error.js";

interface TicketRequestBody {
  categoryId: number;
  title: string;
  description: string;
  location: string;
  priority?: TicketPriority;
}

function isRequestObject(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null;
}

function readOptionalString(
  body: Record<string, unknown>,
  field: "description" | "location",
  maximumLength?: number,
): string {
  const value = body[field];

  if (value === undefined) {
    return "";
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_REQUEST", `${field} must be a string`);
  }

  if (maximumLength !== undefined && value.length > maximumLength) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `${field} must not exceed ${maximumLength} characters`,
    );
  }

  return value.trim();
}

function readTicketBody(body: unknown): TicketRequestBody {
  if (!isRequestObject(body)) {
    throw new HttpError(400, "INVALID_REQUEST", "A JSON request body is required");
  }

  if (!Number.isSafeInteger(body.categoryId) || Number(body.categoryId) <= 0) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      "categoryId must be a positive integer",
    );
  }

  if (typeof body.title !== "string" || body.title.trim() === "") {
    throw new HttpError(400, "INVALID_REQUEST", "title is required");
  }

  const title = body.title.trim();

  if (title.length > 200) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      "title must not exceed 200 characters",
    );
  }

  const priorityValues = Object.values(TicketPriority);
  const priority = body.priority;

  if (
    priority !== undefined &&
    (typeof priority !== "string" ||
      !priorityValues.includes(priority as TicketPriority))
  ) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `priority must be one of: ${priorityValues.join(", ")}`,
    );
  }

  return {
    categoryId: Number(body.categoryId),
    title,
    description: readOptionalString(body, "description"),
    location: readOptionalString(body, "location", 200),
    ...(priority ? { priority: priority as TicketPriority } : {}),
  };
}

export const createTicketController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.authenticatedUser) {
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Login is required");
  }

  const ticket = await createTicket(
    request.authenticatedUser,
    readTicketBody(request.body),
  );

  response.status(201).json({ ticket });
};

function requireAuthenticatedUser(
  authenticatedUser: Express.Request["authenticatedUser"],
) {
  if (!authenticatedUser) {
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Login is required");
  }

  return authenticatedUser;
}

function readTicketId(value: string | string[] | undefined): number {
  if (Array.isArray(value)) {
    throw new HttpError(
      400,
      "INVALID_TICKET_ID",
      "ticketId must be a positive integer",
    );
  }

  const ticketId = Number(value);

  if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
    throw new HttpError(
      400,
      "INVALID_TICKET_ID",
      "ticketId must be a positive integer",
    );
  }

  return ticketId;
}

export const listTicketsController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request.authenticatedUser);
  const tickets = await listTicketsForUser(currentUser);
  response.status(200).json({ tickets });
};

export const getTicketController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request.authenticatedUser);
  const ticket = await getTicketForUser(
    currentUser,
    readTicketId(request.params.ticketId),
  );

  response.status(200).json({ ticket });
};
