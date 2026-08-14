import { DeliveryStatus } from "../generated/prisma/client.js";
import { prisma, type DatabaseClient } from "../database/prisma.js";

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
  providerMessageId: string,
  database: DatabaseClient = prisma,
) {
  return database.emailNotification.update({
    where: { id },
    data: {
      deliveryStatus: DeliveryStatus.SENT,
      providerMessageId,
      errorMessage: null,
      sentAt: new Date(),
    },
  });
}

export function markNotificationFailed(
  id: number,
  errorMessage: string,
  database: DatabaseClient = prisma,
) {
  return database.emailNotification.update({
    where: { id },
    data: {
      deliveryStatus: DeliveryStatus.FAILED,
      providerMessageId: null,
      errorMessage,
      sentAt: null,
    },
  });
}

export function listFailedNotifications(database: DatabaseClient = prisma) {
  return database.emailNotification.findMany({
    where: { deliveryStatus: DeliveryStatus.FAILED },
    orderBy: { createdAt: "asc" },
  });
}
