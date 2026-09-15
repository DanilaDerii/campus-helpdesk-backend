import {
  Role,
  TicketPriority,
  TicketStatus,
} from "../../../generated/prisma/client.js";
import {
  createTicketRecord,
  findCategoryById,
  findTicketAccessRecordById,
  findTicketById,
  findUserById,
  updateTicketAssignment,
  updateTicketStatus,
} from "../../data_access/index.js";
import type { AuthenticatedUser } from "../auth/index.js";
import {
  sendTicketNotification,
  type TicketNotification,
} from "./email.js";
import {
  requireTicketAssignmentAccess,
  requireTicketClaimAccess,
  requireTicketCreationAccess,
  requireTicketStatusChangeAccess,
} from "./access.js";
import { TicketServiceError } from "./errors.js";

export interface CreateTicketInput {
  categoryId: number;
  title: string;
  description: string;
  location: string;
  priority?: TicketPriority;
}

type NotificationDetails = Pick<
  TicketNotification,
  "recipientEmail" | "notificationType"
>;

async function getTicketResult(ticketId: number) {
  const ticket = await findTicketById(ticketId);

  if (!ticket) {
    throw new TicketServiceError(
      "TICKET_NOT_FOUND",
      "The requested ticket does not exist",
    );
  }

  return ticket;
}

async function finishTicketCommand(
  ticketId: number,
  notification?: NotificationDetails,
) {
  const ticket = await getTicketResult(ticketId);

  if (notification) {
    await sendTicketNotification({ ...notification, ticket });
  }

  return ticket;
}

async function getUserEmail(userId: number): Promise<string> {
  const user = await findUserById(userId);

  if (!user) {
    throw new TicketServiceError(
      "TICKET_NOT_FOUND",
      "The ticket requester no longer exists",
    );
  }

  return user.email;
}

export async function createTicket(
  currentUser: AuthenticatedUser,
  input: CreateTicketInput,
) {
  requireTicketCreationAccess(currentUser);

  const category = await findCategoryById(input.categoryId);

  if (!category) {
    throw new TicketServiceError(
      "CATEGORY_NOT_FOUND",
      "The selected ticket category does not exist",
    );
  }

  const ticket = await createTicketRecord({
    requesterId: currentUser.id,
    categoryId: category.id,
    title: input.title,
    description: input.description,
    location: input.location,
    priority: input.priority,
  });

  return finishTicketCommand(ticket.id, {
    recipientEmail: currentUser.email,
    notificationType: "TICKET_CREATED",
  });
}

export async function claimTicket(
  currentUser: AuthenticatedUser,
  ticketId: number,
) {
  requireTicketClaimAccess(currentUser);

  const ticket = await findTicketAccessRecordById(ticketId);

  if (!ticket) {
    throw new TicketServiceError(
      "TICKET_NOT_FOUND",
      "The requested ticket does not exist",
    );
  }

  if (ticket.assignedTechnicianId !== null) {
    throw new TicketServiceError(
      "TICKET_ALREADY_ASSIGNED",
      "This ticket is already assigned",
    );
  }

  if (ticket.status !== TicketStatus.OPEN) {
    throw new TicketServiceError(
      "TICKET_NOT_CLAIMABLE",
      "Only open tickets can be claimed",
    );
  }

  await updateTicketAssignment(ticketId, currentUser.id);

  return finishTicketCommand(ticketId, {
    recipientEmail: await getUserEmail(ticket.requesterId),
    notificationType: "TICKET_ASSIGNED",
  });
}

export async function assignTicketTechnician(
  currentUser: AuthenticatedUser,
  ticketId: number,
  technicianId: number,
) {
  requireTicketAssignmentAccess(currentUser);

  const [ticket, technician] = await Promise.all([
    findTicketAccessRecordById(ticketId),
    findUserById(technicianId),
  ]);

  if (!ticket) {
    throw new TicketServiceError(
      "TICKET_NOT_FOUND",
      "The requested ticket does not exist",
    );
  }

  if (!technician) {
    throw new TicketServiceError(
      "TECHNICIAN_NOT_FOUND",
      "The selected technician does not exist",
    );
  }

  if (technician.role !== Role.TECHNICIAN || !technician.isActive) {
    throw new TicketServiceError(
      "INVALID_TECHNICIAN",
      "The selected user is not an active technician",
    );
  }

  if (ticket.status === TicketStatus.RESOLVED) {
    throw new TicketServiceError(
      "TICKET_ALREADY_RESOLVED",
      "A resolved ticket cannot be assigned",
    );
  }

  if (ticket.assignedTechnicianId === technicianId) {
    return finishTicketCommand(ticketId);
  }

  await updateTicketAssignment(ticketId, technicianId);

  return finishTicketCommand(ticketId, {
    recipientEmail: await getUserEmail(ticket.requesterId),
    notificationType: "TICKET_ASSIGNED",
  });
}

export async function changeTicketStatus(
  currentUser: AuthenticatedUser,
  ticketId: number,
  newStatus: TicketStatus,
) {
  const ticket = await findTicketAccessRecordById(ticketId);

  if (!ticket) {
    throw new TicketServiceError(
      "TICKET_NOT_FOUND",
      "The requested ticket does not exist",
    );
  }

  requireTicketStatusChangeAccess(currentUser, ticket);

  if (ticket.status === newStatus) {
    return finishTicketCommand(ticketId);
  }

  if (ticket.status === TicketStatus.RESOLVED) {
    throw new TicketServiceError(
      "TICKET_ALREADY_RESOLVED",
      "A resolved ticket cannot be reopened",
    );
  }

  const transitionIsAllowed =
    ticket.status === TicketStatus.OPEN
      ? newStatus === TicketStatus.IN_PROGRESS ||
        newStatus === TicketStatus.RESOLVED
      : ticket.status === TicketStatus.IN_PROGRESS &&
        newStatus === TicketStatus.RESOLVED;

  if (!transitionIsAllowed) {
    throw new TicketServiceError(
      "INVALID_STATUS_TRANSITION",
      `Ticket status cannot change from ${ticket.status} to ${newStatus}`,
    );
  }

  await updateTicketStatus(ticketId, newStatus);

  return finishTicketCommand(ticketId, {
    recipientEmail: await getUserEmail(ticket.requesterId),
    notificationType: newStatus === TicketStatus.RESOLVED
      ? "TICKET_RESOLVED"
      : "TICKET_UPDATED",
  });
}
