import {
  createTicketComment,
  findTicketAccessRecordById,
  findTicketById,
  findUserById,
} from "../../data_access/index.js";
import type { AuthenticatedUser } from "../auth/index.js";
import { sendTicketNotification } from "./email.js";
import { requireTicketViewAccess } from "./access.js";
import { TicketServiceError } from "./errors.js";

export async function addTicketComment(
  currentUser: AuthenticatedUser,
  ticketId: number,
  message: string,
) {
  const ticketAccess = await findTicketAccessRecordById(ticketId);

  if (!ticketAccess) {
    throw new TicketServiceError(
      "TICKET_NOT_FOUND",
      "The requested ticket does not exist",
    );
  }

  requireTicketViewAccess(currentUser, ticketAccess);

  const createdComment = await createTicketComment(
    ticketId,
    currentUser.id,
    message,
  );

  const recipientId = currentUser.id === ticketAccess.requesterId
    ? ticketAccess.assignedTechnicianId
    : ticketAccess.requesterId;

  if (recipientId !== null) {
    const [recipient, ticket] = await Promise.all([
      findUserById(recipientId),
      findTicketById(ticketId),
    ]);

    if (recipient && ticket) {
      await sendTicketNotification({
        recipientEmail: recipient.email,
        notificationType: "TICKET_COMMENT_ADDED",
        ticket,
      });
    }
  }

  return createdComment;
}
