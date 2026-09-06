import { DeliveryStatus } from "../../generated/prisma/client.js";
import { prisma, type DatabaseClient } from "../database/prisma.js";

const retryableStatuses = [DeliveryStatus.PENDING, DeliveryStatus.FAILED];

export interface PendingNotificationInput {
  ticketId: number;
  recipientEmail: string;
  notificationType: string;
}

export function createPendingNotification(
  input: PendingNotificationInput,
  database: DatabaseClient = prisma,
) {
  return database.emailNotification.create({
    data: input,
  });
}

export function markNotificationSent(
  id: number,
  attemptCount: number,
  providerMessageId: string | null,
  database: DatabaseClient = prisma,
) {
  return database.emailNotification.updateMany({
    where: { id, attemptCount, deliveryStatus: { in: retryableStatuses } },
    data: {
      deliveryStatus: DeliveryStatus.SENT,
      providerMessageId,
      errorMessage: null,
      sentAt: new Date(),
      nextAttemptAt: null,
    },
  });
}

export function markNotificationFailed(
  id: number,
  attemptCount: number,
  errorMessage: string,
  nextAttemptAt: Date | null,
  database: DatabaseClient = prisma,
) {
  return database.emailNotification.updateMany({
    where: { id, attemptCount, deliveryStatus: { in: retryableStatuses } },
    data: {
      deliveryStatus: nextAttemptAt === null
        ? DeliveryStatus.EXHAUSTED : DeliveryStatus.FAILED,
      providerMessageId: null,
      errorMessage,
      sentAt: null,
      nextAttemptAt,
    },
  });
}

// Reserve an attempt before sending. The lease lets an interrupted attempt recover.
export async function claimNotificationAttempt(
  id: number,
  attemptCount: number,
  now: Date,
  leaseUntil: Date,
  database: DatabaseClient = prisma,
): Promise<boolean> {
  const result = await database.emailNotification.updateMany({
    where: {
      id,
      attemptCount,
      deliveryStatus: { in: retryableStatuses },
      nextAttemptAt: { lte: now },
    },
    data: { attemptCount: { increment: 1 }, nextAttemptAt: leaseUntil },
  });
  return result.count === 1;
}

export function findNotificationForDelivery(
  id: number,
  database: DatabaseClient = prisma,
) {
  return database.emailNotification.findUnique({
    where: { id },
    include: {
      ticket: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });
}

export function listUndeliveredNotifications(
  limit: number,
  database: DatabaseClient = prisma,
) {
  return database.emailNotification.findMany({
    where: {
      deliveryStatus: { in: retryableStatuses },
      nextAttemptAt: { lte: new Date() },
    },
    select: { id: true },
    orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
    take: limit,
  });
}
