import {
  Role,
  TicketPriority,
  TicketSource,
} from "../generated/prisma/client.js";
import {
  createPendingNotification,
  createTicketHistory,
  createTicketRecord,
  findCategoryById,
  findTicketById,
  listAllTickets,
  listTicketsByRequester,
  listTicketsVisibleToTechnician,
} from "../repositories/index.js";
import { runInTransaction } from "../database/prisma.js";
import type { AuthenticatedUser } from "./auth.service.js";

export interface CreateTicketInput {
  categoryId: number;
  title: string;
  description: string;
  location: string;
  priority?: TicketPriority;
}

export type TicketServiceErrorCode =
  | "TICKET_CREATION_FORBIDDEN"
  | "CATEGORY_NOT_FOUND"
  | "TICKET_NOT_FOUND"
  | "TICKET_ACCESS_FORBIDDEN";

export class TicketServiceError extends Error {
  constructor(
    public readonly code: TicketServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TicketServiceError";
  }
}

const ticketCreatorRoles = new Set<Role>([
  Role.STUDENT,
  Role.FACULTY,
  Role.ADMIN,
]);

export async function createTicket(
  currentUser: AuthenticatedUser,
  input: CreateTicketInput,
) {
  if (!ticketCreatorRoles.has(currentUser.role)) {
    throw new TicketServiceError(
      "TICKET_CREATION_FORBIDDEN",
      "This role cannot create HelpDesk tickets",
    );
  }

  const category = await findCategoryById(input.categoryId);

  if (!category) {
    throw new TicketServiceError(
      "CATEGORY_NOT_FOUND",
      "The selected ticket category does not exist",
    );
  }

  return runInTransaction(async (transaction) => {
    const ticket = await createTicketRecord(
      {
        requesterId: currentUser.id,
        categoryId: category.id,
        title: input.title,
        description: input.description,
        location: input.location,
        priority: input.priority,
        source: TicketSource.HELPDESK,
      },
      transaction,
    );

    await createTicketHistory(
      {
        ticketId: ticket.id,
        changedById: currentUser.id,
        action: "CREATED",
        newValue: ticket.status,
      },
      transaction,
    );

    await createPendingNotification(
      {
        ticketId: ticket.id,
        recipientEmail: currentUser.email,
        notificationType: "TICKET_CREATED",
      },
      transaction,
    );

    return ticket;
  });
}

export function listTicketsForUser(currentUser: AuthenticatedUser) {
  if (currentUser.role === Role.ADMIN) {
    return listAllTickets();
  }

  if (currentUser.role === Role.TECHNICIAN) {
    return listTicketsVisibleToTechnician(currentUser.id);
  }

  return listTicketsByRequester(currentUser.id);
}

export async function getTicketForUser(
  currentUser: AuthenticatedUser,
  ticketId: number,
) {
  const ticket = await findTicketById(ticketId);

  if (!ticket) {
    throw new TicketServiceError(
      "TICKET_NOT_FOUND",
      "The requested ticket does not exist",
    );
  }

  const isRequester = ticket.requesterId === currentUser.id;
  const isAssignedTechnician =
    ticket.assignedTechnicianId === currentUser.id &&
    currentUser.role === Role.TECHNICIAN;
  const isAvailableToTechnician =
    currentUser.role === Role.TECHNICIAN &&
    ticket.assignedTechnicianId === null &&
    ticket.status === "OPEN";
  const mayView =
    currentUser.role === Role.ADMIN ||
    isRequester ||
    isAssignedTechnician ||
    isAvailableToTechnician;

  if (!mayView) {
    throw new TicketServiceError(
      "TICKET_ACCESS_FORBIDDEN",
      "You do not have permission to view this ticket",
    );
  }

  return ticket;
}
