import { Router, type RequestHandler } from "express";
import {
  TicketPriority,
  TicketStatus,
} from "../../generated/prisma/client.js";
import {
  addTicketComment,
  assignTicketTechnician,
  changeTicketStatus,
  claimTicket,
  createTicket,
  getTicketForUser,
  listTicketsForUser,
  type CreateTicketInput,
} from "../services/ticket/index.js";
import { requireAuthentication } from "./guardrails/authentication.js";
import {
  readEnumValue,
  readPositiveIntegerParameter,
  readPositiveIntegerValue,
  readRequestObject,
  readStringValue,
  requireAuthenticatedUser,
} from "./guardrails/validation.js";

function readTicketBody(body: unknown): CreateTicketInput {
  const requestBody = readRequestObject(body);
  const priorityValues = Object.values(TicketPriority);
  const priority = requestBody.priority === undefined
    ? undefined
    : readEnumValue(requestBody.priority, "priority", priorityValues);

  return {
    categoryId: readPositiveIntegerValue(requestBody.categoryId, "categoryId"),
    title: readStringValue(requestBody.title, "title", { maximumLength: 200 }),
    description: requestBody.description === undefined
      ? ""
      : readStringValue(requestBody.description, "description", {
        allowEmpty: true,
      }),
    location: requestBody.location === undefined
      ? ""
      : readStringValue(requestBody.location, "location", {
        allowEmpty: true,
        maximumLength: 200,
      }),
    ...(priority !== undefined ? { priority } : {}),
  };
}

const createTicketHandler: RequestHandler = async (request, response) => {
  const ticket = await createTicket(
    requireAuthenticatedUser(request),
    readTicketBody(request.body),
  );
  response.status(201).json({ ticket });
};

const listTicketsHandler: RequestHandler = async (request, response) => {
  const tickets = await listTicketsForUser(requireAuthenticatedUser(request));
  response.status(200).json({ tickets });
};

const getTicketHandler: RequestHandler = async (request, response) => {
  const ticket = await getTicketForUser(
    requireAuthenticatedUser(request),
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
  );
  response.status(200).json({ ticket });
};

const claimTicketHandler: RequestHandler = async (request, response) => {
  const ticket = await claimTicket(
    requireAuthenticatedUser(request),
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
  );
  response.status(200).json({ ticket });
};

const assignTicketHandler: RequestHandler = async (request, response) => {
  const body = readRequestObject(request.body);
  const ticket = await assignTicketTechnician(
    requireAuthenticatedUser(request),
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
    readPositiveIntegerValue(body.technicianId, "technicianId"),
  );
  response.status(200).json({ ticket });
};

const updateTicketStatusHandler: RequestHandler = async (request, response) => {
  const body = readRequestObject(request.body);
  const ticket = await changeTicketStatus(
    requireAuthenticatedUser(request),
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
    readEnumValue(body.status, "status", Object.values(TicketStatus)),
  );
  response.status(200).json({ ticket });
};

const addTicketCommentHandler: RequestHandler = async (request, response) => {
  const body = readRequestObject(request.body);
  const comment = await addTicketComment(
    requireAuthenticatedUser(request),
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
    readStringValue(body.message, "Comment message", { maximumLength: 5000 }),
  );
  response.status(201).json({ comment });
};

export const ticketRoutes = Router();

ticketRoutes.use(requireAuthentication);
ticketRoutes.post("/", createTicketHandler);
ticketRoutes.get("/", listTicketsHandler);
ticketRoutes.get("/:ticketId", getTicketHandler);
ticketRoutes.post("/:ticketId/claim", claimTicketHandler);
ticketRoutes.patch("/:ticketId/status", updateTicketStatusHandler);
ticketRoutes.patch("/:ticketId/assignment", assignTicketHandler);
ticketRoutes.post("/:ticketId/comments", addTicketCommentHandler);
