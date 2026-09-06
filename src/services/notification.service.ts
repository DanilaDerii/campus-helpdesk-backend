import { createProductionEmailProvider } from "../alex/email/index.js";
import { logEvent, safeErrorDetails } from "../logging/logger.js";
import { ConsoleEmailProvider } from "../providers/email/console-email-provider.js";
import type {
  EmailMessage,
  EmailProvider,
} from "../providers/email/email-provider.js";
import {
  claimNotificationAttempt,
  findNotificationForDelivery,
  listUndeliveredNotifications,
  markNotificationFailed,
  markNotificationSent,
} from "../repositories/index.js";

const DEFAULT_RETRY_INTERVAL_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [5, 15, 60, 360].map((minutes) => minutes * 60 * 1000);
const MAXIMUM_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const RETRY_BATCH_SIZE = 25;
const ATTEMPT_LEASE_MS = 5 * 60 * 1000;
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

/** Attempt one delivery and always absorb failures after recording them. */
export async function deliverNotification(
  notificationId: number,
): Promise<boolean> {
  if (activeDeliveries.has(notificationId)) {
    return false;
  }

  activeDeliveries.add(notificationId);
  let attempt: number | undefined;

  try {
    const notification = await findNotificationForDelivery(notificationId);
    const now = new Date();

    if (
      !notification ||
      (notification.deliveryStatus !== "PENDING" && notification.deliveryStatus !== "FAILED") ||
      !notification.nextAttemptAt || notification.nextAttemptAt > now
    ) {
      return false;
    }

    if (notification.attemptCount >= MAXIMUM_ATTEMPTS) {
      const exhausted = await markNotificationFailed(
        notificationId,
        notification.attemptCount,
        "RETRY_LIMIT_REACHED_AFTER_INTERRUPTED_ATTEMPT",
        null,
      );
      if (exhausted.count === 1) {
        logEvent("error", "email_delivery_exhausted", {
          operation: "email_delivery",
          notificationId,
          attempt: notification.attemptCount,
        });
      }
      return false;
    }

    const claimed = await claimNotificationAttempt(
      notificationId,
      notification.attemptCount,
      now,
      new Date(now.getTime() + ATTEMPT_LEASE_MS),
    );
    if (!claimed) return false;
    attempt = notification.attemptCount + 1;

    const result = await emailProvider.send(buildEmailMessage(notification));
    const recorded = await markNotificationSent(
      notification.id,
      attempt,
      result.providerMessageId ?? null,
    );
    if (recorded.count === 1 && attempt > 1) {
      logEvent("info", "email_delivery_recovered", {
        operation: "email_delivery", notificationId, attempt,
      });
    }
    return recorded.count === 1;
  } catch (error: unknown) {
    const details = safeErrorDetails(error);
    if (attempt === undefined) {
      logEvent("error", "email_attempt_unavailable", {
        operation: "email_delivery", notificationId, ...details,
      });
      return false;
    }

    const nextAttemptAt = attempt < MAXIMUM_ATTEMPTS
      ? new Date(Date.now() + RETRY_DELAYS_MS[attempt - 1])
      : null;

    try {
      const recorded = await markNotificationFailed(
        notificationId, attempt, JSON.stringify(details), nextAttemptAt,
      );
      if (recorded.count === 1) {
        logEvent(
          nextAttemptAt ? "warn" : "error",
          nextAttemptAt ? "email_retry_scheduled" : "email_delivery_exhausted",
          {
            ...details,
            operation: "email_delivery", notificationId, attempt,
            nextAttemptAt: nextAttemptAt?.toISOString(),
          },
        );
      }
    } catch (recordingError: unknown) {
      logEvent("error", "email_failure_recording_failed", {
        operation: "email_delivery", notificationId, attempt,
        ...safeErrorDetails(recordingError),
      });
    }

    return false;
  } finally {
    activeDeliveries.delete(notificationId);
  }
}

export async function retryUndeliveredNotifications(): Promise<void> {
  const notifications = await listUndeliveredNotifications(RETRY_BATCH_SIZE);

  for (const notification of notifications) {
    await deliverNotification(notification.id);
  }
}

/** Start a small in-process retry worker and return its cleanup function. */
export function startNotificationRetryWorker(
  intervalMs: number = DEFAULT_RETRY_INTERVAL_MS,
): () => void {
  let isRetrying = false;
  let retryFailureLogged = false;

  const retry = async () => {
    if (isRetrying) {
      return;
    }

    isRetrying = true;

    try {
      await retryUndeliveredNotifications();
      if (retryFailureLogged) {
        logEvent("info", "notification_worker_recovered", { operation: "notification_retry" });
      }
      retryFailureLogged = false;
    } catch (error: unknown) {
      if (!retryFailureLogged) {
        logEvent("error", "notification_worker_failed", {
          operation: "notification_retry", ...safeErrorDetails(error),
        });
      }
      retryFailureLogged = true;
    } finally {
      isRetrying = false;
    }
  };

  void retry();
  const timer = setInterval(() => void retry(), intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}
