import { runInTransaction } from "../../database/prisma.js";
import {
  createPendingNotification,
  createTicketComment,
  createTicketHistory,
  findTicketAccessRecordById,
  listTicketComments,
} from "../../repositories/index.js";
import type { AuthenticatedUser } from "../auth.service.js";
import { requireTicketViewAccess } from "./access.js";
import { deliverAfterCommit } from "./delivery.js";
import { TicketServiceError } from "./errors.js";

export async function addTicketComment(
  currentUser: AuthenticatedUser,
  ticketId: number,
  message: string,
) {
  const result = await runInTransaction(async (transaction) => {
    const ticket = await findTicketAccessRecordById(ticketId, transaction);

    if (!ticket) {
      throw new TicketServiceError(
        "TICKET_NOT_FOUND",
        "The requested ticket does not exist",
      );
    }

    requireTicketViewAccess(currentUser, ticket);

    const comment = await createTicketComment(
      ticketId,
      currentUser.id,
      message,
      transaction,
    );

    await createTicketHistory(
      {
        ticketId,
        changedById: currentUser.id,
        action: "COMMENT_ADDED",
        newValue: String(comment.id),
      },
      transaction,
    );

    const recipientEmail =
      currentUser.id === ticket.requesterId
        ? ticket.assignedTechnician?.email
        : ticket.requester.email;

    const notification = recipientEmail
      ? await createPendingNotification(
          {
            ticketId,
            recipientEmail,
            notificationType: "TICKET_COMMENT_ADDED",
          },
          transaction,
        )
      : undefined;

    return { value: comment, notificationId: notification?.id };
  });

  return deliverAfterCommit(result);
}

export async function getTicketCommentsForUser(
  currentUser: AuthenticatedUser,
  ticketId: number,
) {
  const ticket = await findTicketAccessRecordById(ticketId);

  if (!ticket) {
    throw new TicketServiceError(
      "TICKET_NOT_FOUND",
      "The requested ticket does not exist",
    );
  }

  requireTicketViewAccess(currentUser, ticket);
  return listTicketComments(ticketId);
}
