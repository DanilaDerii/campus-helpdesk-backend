import {
  Role,
  TicketPriority,
  TicketSource,
  TicketStatus,
} from "../../../generated/prisma/client.js";
import { runInTransaction } from "../../database/prisma.js";
import {
  assignTechnician,
  claimOpenTicket,
  createPendingNotification,
  createTicketHistory,
  createTicketRecord,
  findCategoryById,
  findTicketById,
  findUserById,
  transitionTicketStatus,
} from "../../repositories/index.js";
import type { AuthenticatedUser } from "../auth.service.js";
import {
  requireTicketAssignmentAccess,
  requireTicketClaimAccess,
  requireTicketCreationAccess,
  requireTicketStatusChangeAccess,
} from "./access.js";
import { deliverAfterCommit } from "./delivery.js";
import { TicketServiceError } from "./errors.js";

export interface CreateTicketInput {
  categoryId: number;
  title: string;
  description: string;
  location: string;
  priority?: TicketPriority;
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

  const result = await runInTransaction(async (transaction) => {
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

    const notification = await createPendingNotification(
      {
        ticketId: ticket.id,
        recipientEmail: currentUser.email,
        notificationType: "TICKET_CREATED",
      },
      transaction,
    );

    return { value: ticket, notificationId: notification.id };
  });

  return deliverAfterCommit(result);
}

export async function claimTicket(
  currentUser: AuthenticatedUser,
  ticketId: number,
) {
  requireTicketClaimAccess(currentUser);

  const result = await runInTransaction(async (transaction) => {
    const claimed = await claimOpenTicket(
      ticketId,
      currentUser.id,
      transaction,
    );

    if (!claimed) {
      const existingTicket = await findTicketById(ticketId, transaction);

      if (!existingTicket) {
        throw new TicketServiceError(
          "TICKET_NOT_FOUND",
          "The requested ticket does not exist",
        );
      }

      if (existingTicket.assignedTechnicianId !== null) {
        throw new TicketServiceError(
          "TICKET_ALREADY_ASSIGNED",
          "This ticket is already assigned",
        );
      }

      throw new TicketServiceError(
        "TICKET_NOT_CLAIMABLE",
        "Only open tickets can be claimed",
      );
    }

    const ticket = await findTicketById(ticketId, transaction);

    if (!ticket) {
      throw new TicketServiceError(
        "TICKET_NOT_FOUND",
        "The requested ticket does not exist",
      );
    }

    await createTicketHistory(
      {
        ticketId,
        changedById: currentUser.id,
        action: "ASSIGNED",
        newValue: String(currentUser.id),
      },
      transaction,
    );

    await createTicketHistory(
      {
        ticketId,
        changedById: currentUser.id,
        action: "STATUS_CHANGED",
        oldValue: TicketStatus.OPEN,
        newValue: TicketStatus.IN_PROGRESS,
      },
      transaction,
    );

    const notification = await createPendingNotification(
      {
        ticketId,
        recipientEmail: ticket.requester.email,
        notificationType: "TICKET_ASSIGNED",
      },
      transaction,
    );

    const updatedTicket = await findTicketById(ticketId, transaction);

    if (!updatedTicket) {
      throw new TicketServiceError(
        "TICKET_NOT_FOUND",
        "The requested ticket does not exist",
      );
    }

    return { value: updatedTicket, notificationId: notification.id };
  });

  return deliverAfterCommit(result);
}

export async function assignTicketTechnician(
  currentUser: AuthenticatedUser,
  ticketId: number,
  technicianId: number,
) {
  requireTicketAssignmentAccess(currentUser);

  const result = await runInTransaction(async (transaction) => {
    const ticket = await findTicketById(ticketId, transaction);
    const technician = await findUserById(technicianId, transaction);

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

    const previousTechnicianId = ticket.assignedTechnicianId;
    const previousStatus = ticket.status;

    await assignTechnician(ticketId, technicianId, transaction);

    await createTicketHistory(
      {
        ticketId,
        changedById: currentUser.id,
        action: previousTechnicianId === null ? "ASSIGNED" : "REASSIGNED",
        oldValue:
          previousTechnicianId === null ? "" : String(previousTechnicianId),
        newValue: String(technicianId),
      },
      transaction,
    );

    if (previousStatus === TicketStatus.OPEN) {
      await createTicketHistory(
        {
          ticketId,
          changedById: currentUser.id,
          action: "STATUS_CHANGED",
          oldValue: TicketStatus.OPEN,
          newValue: TicketStatus.IN_PROGRESS,
        },
        transaction,
      );
    }

    const notification = await createPendingNotification(
      {
        ticketId,
        recipientEmail: ticket.requester.email,
        notificationType: "TICKET_ASSIGNED",
      },
      transaction,
    );

    const updatedTicket = await findTicketById(ticketId, transaction);

    if (!updatedTicket) {
      throw new TicketServiceError(
        "TICKET_NOT_FOUND",
        "The requested ticket does not exist",
      );
    }

    return { value: updatedTicket, notificationId: notification.id };
  });

  return deliverAfterCommit(result);
}

export async function changeTicketStatus(
  currentUser: AuthenticatedUser,
  ticketId: number,
  newStatus: TicketStatus,
) {
  const result = await runInTransaction(async (transaction) => {
    const ticket = await findTicketById(ticketId, transaction);

    if (!ticket) {
      throw new TicketServiceError(
        "TICKET_NOT_FOUND",
        "The requested ticket does not exist",
      );
    }

    requireTicketStatusChangeAccess(currentUser, ticket);

    if (ticket.status === newStatus) {
      return { value: ticket };
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

    const statusChanged = await transitionTicketStatus(
      ticketId,
      ticket.status,
      newStatus,
      transaction,
    );

    if (!statusChanged) {
      throw new TicketServiceError(
        "TICKET_STATUS_CONFLICT",
        "The ticket status was changed by another request; reload and try again",
      );
    }

    await createTicketHistory(
      {
        ticketId,
        changedById: currentUser.id,
        action: "STATUS_CHANGED",
        oldValue: ticket.status,
        newValue: newStatus,
      },
      transaction,
    );

    const notification = await createPendingNotification(
      {
        ticketId,
        recipientEmail: ticket.requester.email,
        notificationType:
          newStatus === TicketStatus.RESOLVED
            ? "TICKET_RESOLVED"
            : "TICKET_UPDATED",
      },
      transaction,
    );

    const updatedTicket = await findTicketById(ticketId, transaction);

    if (!updatedTicket) {
      throw new TicketServiceError(
        "TICKET_NOT_FOUND",
        "The requested ticket does not exist",
      );
    }

    return { value: updatedTicket, notificationId: notification.id };
  });

  return deliverAfterCommit(result);
}
