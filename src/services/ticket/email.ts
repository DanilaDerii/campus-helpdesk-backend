import {
  sendEmail,
  type EmailMessage,
} from "../../integrations/email/email.js";

export type TicketNotificationType =
  | "TICKET_CREATED"
  | "TICKET_ASSIGNED"
  | "TICKET_UPDATED"
  | "TICKET_RESOLVED"
  | "TICKET_COMMENT_ADDED";

export interface TicketNotification {
  recipientEmail: string;
  notificationType: TicketNotificationType;
  ticket: { id: number; title: string; status: string };
}

function buildEmailMessage(notification: TicketNotification): EmailMessage {
  const ticketLabel = `Ticket #${notification.ticket.id}`;
  const subjects: Record<TicketNotificationType, string> = {
    TICKET_CREATED: `${ticketLabel} created`,
    TICKET_ASSIGNED: `${ticketLabel} assigned`,
    TICKET_UPDATED: `${ticketLabel} updated`,
    TICKET_RESOLVED: `${ticketLabel} resolved`,
    TICKET_COMMENT_ADDED: `New comment on ${ticketLabel}`,
  };

  return {
    to: notification.recipientEmail,
    subject: subjects[notification.notificationType],
    text: [
      ticketLabel,
      `Title: ${notification.ticket.title}`,
      `Status: ${notification.ticket.status}`,
    ].join("\n"),
  };
}

/** Send one email. An email failure does not undo the ticket operation. */
export async function sendTicketNotification(
  notification: TicketNotification,
): Promise<void> {
  try {
    await sendEmail(buildEmailMessage(notification));
  } catch {
    console.error("Email delivery failed");
  }
}
