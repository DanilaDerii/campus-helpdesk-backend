import { runInTransaction } from "../../database/prisma.js";
import {
  createPendingNotification,
  createTicketComment,
  createTicketHistory,
  findTicketCommentById,
  findTicketAccessRecordById,
  findUserById,
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

    const recipientId =
      currentUser.id === ticket.requesterId
        ? ticket.assignedTechnicianId
        : ticket.requesterId;

    const recipient = recipientId === null
      ? null : await findUserById(recipientId, transaction);

    const notification = recipient
      ? await createPendingNotification(
          {
            ticketId,
            recipientEmail: recipient.email,
            notificationType: "TICKET_COMMENT_ADDED",
          },
          transaction,
        )
      : undefined;

    return { commentId: comment.id, notificationId: notification?.id };
  });

  await deliverAfterCommit({
    value: undefined,
    notificationId: result.notificationId,
  });

  const comment = await findTicketCommentById(result.commentId);

  if (!comment) {
    throw new TicketServiceError(
      "TICKET_NOT_FOUND",
      "The new ticket comment could not be loaded",
    );
  }

  return comment;
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
