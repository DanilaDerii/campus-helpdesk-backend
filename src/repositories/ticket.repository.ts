import {
  TicketPriority,
  TicketSource,
  TicketStatus,
} from "../generated/prisma/client.js";
import { prisma, type DatabaseClient } from "../database/prisma.js";

export interface CreateTicketRecordInput {
  requesterId: number;
  categoryId: number;
  title: string;
  description?: string;
  location?: string;
  priority?: TicketPriority;
  source?: TicketSource;
}

const safeUserSelection = {
  id: true,
  email: true,
  displayName: true,
  role: true,
} as const;

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
      ...(input.source ? { source: input.source } : {}),
    },
    include: ticketSummaryRelations,
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
      history: {
        include: { changedBy: { select: safeUserSelection } },
        orderBy: { createdAt: "asc" },
      },
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

export function listAvailableTickets(database: DatabaseClient = prisma) {
  return database.ticket.findMany({
    where: {
      assignedTechnicianId: null,
      status: TicketStatus.OPEN,
    },
    include: ticketSummaryRelations,
    orderBy: { createdAt: "asc" },
  });
}

export function listTicketsAssignedToTechnician(
  technicianId: number,
  database: DatabaseClient = prisma,
) {
  return database.ticket.findMany({
    where: { assignedTechnicianId: technicianId },
    include: ticketSummaryRelations,
    orderBy: { updatedAt: "desc" },
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

/** Returns false when the ticket is missing, assigned, or no longer open. */
export async function claimOpenTicket(
  ticketId: number,
  technicianId: number,
  database: DatabaseClient = prisma,
): Promise<boolean> {
  const result = await database.ticket.updateMany({
    where: {
      id: ticketId,
      assignedTechnicianId: null,
      status: TicketStatus.OPEN,
    },
    data: {
      assignedTechnicianId: technicianId,
      status: TicketStatus.IN_PROGRESS,
    },
  });

  return result.count === 1;
}

export function assignTechnician(
  ticketId: number,
  technicianId: number | null,
  database: DatabaseClient = prisma,
) {
  return database.ticket.update({
    where: { id: ticketId },
    data: { assignedTechnicianId: technicianId },
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
