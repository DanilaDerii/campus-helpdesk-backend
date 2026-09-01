import { createProductionEmailProvider } from "../alex/email/index.js";
import { ConsoleEmailProvider } from "../providers/email/console-email-provider.js";
import type {
  EmailMessage,
  EmailProvider,
} from "../providers/email/email-provider.js";
import {
  findNotificationForDelivery,
  listUndeliveredNotifications,
  markNotificationFailed,
  markNotificationSent,
} from "../repositories/index.js";

const DEFAULT_RETRY_INTERVAL_MS = 5 * 60 * 1000;
const activeDeliveries = new Set<number>();

function createEmailProvider(): EmailProvider {
  return process.env.NODE_ENV === "production"
    ? createProductionEmailProvider()
    : new ConsoleEmailProvider();
}

let emailProvider = createEmailProvider();

export function configureEmailProvider(provider: EmailProvider): void {
  emailProvider = provider;
}

function buildEmailMessage(notification: {
  recipientEmail: string;
  notificationType: string;
  ticket: { id: number; title: string; status: string };
}): EmailMessage {
  const ticketLabel = `Ticket #${notification.ticket.id}`;
  const subjectByType: Record<string, string> = {
    TICKET_CREATED: `${ticketLabel} created`,
    TICKET_ASSIGNED: `${ticketLabel} assigned`,
    TICKET_UPDATED: `${ticketLabel} updated`,
    TICKET_RESOLVED: `${ticketLabel} resolved`,
    TICKET_COMMENT_ADDED: `New comment on ${ticketLabel}`,
  };

  return {
    to: notification.recipientEmail,
    subject:
      subjectByType[notification.notificationType] ?? `${ticketLabel} updated`,
    text: [
      ticketLabel,
      `Title: ${notification.ticket.title}`,
      `Status: ${notification.ticket.status}`,
    ].join("\n"),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 2000)
    : "The email provider returned an unknown error";
}

/** Attempt one delivery and always absorb failures after recording them. */
export async function deliverNotification(
  notificationId: number,
): Promise<boolean> {
  if (activeDeliveries.has(notificationId)) {
    return false;
  }

  activeDeliveries.add(notificationId);

  try {
    const notification = await findNotificationForDelivery(notificationId);

    if (!notification || notification.deliveryStatus === "SENT") {
      return false;
    }

    const result = await emailProvider.send(buildEmailMessage(notification));
    await markNotificationSent(
      notification.id,
      result.providerMessageId ?? null,
    );
    return true;
  } catch (error: unknown) {
    const message = errorMessage(error);

    try {
      await markNotificationFailed(notificationId, message);
    } catch (recordingError: unknown) {
      console.error(
        `Could not record email failure for notification ${notificationId}: ${errorMessage(recordingError)}`,
      );
    }

    console.error(`Email notification ${notificationId} failed: ${message}`);
    return false;
  } finally {
    activeDeliveries.delete(notificationId);
  }
}

export async function retryUndeliveredNotifications(): Promise<void> {
  const notifications = await listUndeliveredNotifications();

  for (const notification of notifications) {
    await deliverNotification(notification.id);
  }
}

/** Start a small in-process retry worker and return its cleanup function. */
export function startNotificationRetryWorker(
  intervalMs: number = DEFAULT_RETRY_INTERVAL_MS,
): () => void {
  let isRetrying = false;

  const retry = async () => {
    if (isRetrying) {
      return;
    }

    isRetrying = true;

    try {
      await retryUndeliveredNotifications();
    } catch (error: unknown) {
      console.error(`Notification retry failed: ${errorMessage(error)}`);
    } finally {
      isRetrying = false;
    }
  };

  void retry();
  const timer = setInterval(() => void retry(), intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}
