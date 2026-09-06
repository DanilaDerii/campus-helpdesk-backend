import type { RequestHandler } from "express";
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
  getTicketCommentsForUser,
  getTicketForUser,
  getTicketHistoryForUser,
  listTicketsForUser,
  type CreateTicketInput,
} from "../services/ticket.service.js";
import {
  readEnumValue,
  readPositiveIntegerParameter,
  readPositiveIntegerValue,
  readRequestObject,
  readStringValue,
  requireAuthenticatedUser,
} from "../validation/request-validation.js";

function readTicketBody(body: unknown): CreateTicketInput {
  const requestBody = readRequestObject(body);
  const priorityValues = Object.values(TicketPriority);
  const priority =
    requestBody.priority === undefined
      ? undefined
      : readEnumValue(requestBody.priority, "priority", priorityValues);

  return {
    categoryId: readPositiveIntegerValue(requestBody.categoryId, "categoryId"),
    title: readStringValue(requestBody.title, "title", { maximumLength: 200 }),
    description:
      requestBody.description === undefined
        ? ""
        : readStringValue(requestBody.description, "description", {
            allowEmpty: true,
          }),
    location:
      requestBody.location === undefined
        ? ""
        : readStringValue(requestBody.location, "location", {
            allowEmpty: true,
            maximumLength: 200,
          }),
    ...(priority !== undefined ? { priority } : {}),
  };
}

export const createTicketController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const ticket = await createTicket(
    currentUser,
    readTicketBody(request.body),
  );

  response.status(201).json({ ticket });
};

export const listTicketsController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const tickets = await listTicketsForUser(currentUser);
  response.status(200).json({ tickets });
};

export const getTicketController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const ticket = await getTicketForUser(
    currentUser,
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
  );

  response.status(200).json({ ticket });
};

export const claimTicketController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const ticket = await claimTicket(
    currentUser,
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
  );

  response.status(200).json({ ticket });
};

export const assignTicketController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const body = readRequestObject(request.body);
  const ticket = await assignTicketTechnician(
    currentUser,
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
    readPositiveIntegerValue(body.technicianId, "technicianId"),
  );

  response.status(200).json({ ticket });
};

export const updateTicketStatusController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const body = readRequestObject(request.body);
  const ticket = await changeTicketStatus(
    currentUser,
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
    readEnumValue(body.status, "status", Object.values(TicketStatus)),
  );

  response.status(200).json({ ticket });
};

export const addTicketCommentController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const body = readRequestObject(request.body);
  const comment = await addTicketComment(
    currentUser,
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
    readStringValue(body.message, "Comment message", { maximumLength: 5000 }),
  );

  response.status(201).json({ comment });
};

export const listTicketCommentsController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const comments = await getTicketCommentsForUser(
    currentUser,
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
  );

  response.status(200).json({ comments });
};

export const listTicketHistoryController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const history = await getTicketHistoryForUser(
    currentUser,
    readPositiveIntegerParameter(
      request.params.ticketId,
      "ticketId",
      "INVALID_TICKET_ID",
    ),
  );

  response.status(200).json({ history });
};
