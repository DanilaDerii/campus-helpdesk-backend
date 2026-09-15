import {
  TicketPriority,
  TicketStatus,
} from "../../generated/prisma/client.js";
import { prisma, type DatabaseClient } from "../database/prisma.js";
import { safeUserSelection } from "./user-selection.js";

export interface CreateTicketRecordInput {
  requesterId: number;
  categoryId: number;
  title: string;
  description?: string;
  location?: string;
  priority?: TicketPriority;
}

const ticketSummaryRelations = {
  requester: { select: safeUserSelection },
  assignedTechnician: { select: safeUserSelection },
  category: true,
} as const;

export function createTicketRecord(
  input: CreateTicketRecordInput,
  database: DatabaseClient = prisma,
) {
  return database.ticket.create({
    data: {
      requesterId: input.requesterId,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description ?? "",
      location: input.location ?? "",
      ...(input.priority ? { priority: input.priority } : {}),
    },
  });
}

export function findTicketById(
  id: number,
  database: DatabaseClient = prisma,
) {
  return database.ticket.findUnique({
    where: { id },
    include: {
      ...ticketSummaryRelations,
      comments: {
        include: { author: { select: safeUserSelection } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** Load only the ticket fields needed for access checks and notifications. */
export function findTicketAccessRecordById(
  id: number,
  database: DatabaseClient = prisma,
) {
  return database.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      requesterId: true,
      assignedTechnicianId: true,
      status: true,
    },
  });
}

export function listTicketsByRequester(
  requesterId: number,
  database: DatabaseClient = prisma,
) {
  return database.ticket.findMany({
    where: { requesterId },
    include: ticketSummaryRelations,
    orderBy: { createdAt: "desc" },
  });
}

export function listTicketsVisibleToTechnician(
  technicianId: number,
  database: DatabaseClient = prisma,
) {
  return database.ticket.findMany({
    where: {
      OR: [
        { assignedTechnicianId: technicianId },
        {
          assignedTechnicianId: null,
          status: TicketStatus.OPEN,
        },
      ],
    },
    include: ticketSummaryRelations,
    orderBy: { createdAt: "desc" },
  });
}

export function listAllTickets(database: DatabaseClient = prisma) {
  return database.ticket.findMany({
    include: ticketSummaryRelations,
    orderBy: { createdAt: "desc" },
  });
}

export function updateTicketAssignment(
  ticketId: number,
  technicianId: number,
  database: DatabaseClient = prisma,
) {
  return database.ticket.update({
    where: { id: ticketId },
    data: {
      assignedTechnicianId: technicianId,
      status: TicketStatus.IN_PROGRESS,
    },
  });
}

export function updateTicketStatus(
  ticketId: number,
  status: TicketStatus,
  database: DatabaseClient = prisma,
) {
  return database.ticket.update({
    where: { id: ticketId },
    data: {
      status,
      resolvedAt: status === TicketStatus.RESOLVED ? new Date() : null,
    },
  });
}
