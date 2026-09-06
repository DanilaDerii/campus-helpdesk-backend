import { prisma, type DatabaseClient } from "../database/prisma.js";
import { safeUserSelection } from "./user-selection.js";

export interface CreateHistoryInput {
  ticketId: number;
  changedById?: number;
  action: string;
  oldValue?: string;
  newValue?: string;
}

export function createTicketHistory(
  input: CreateHistoryInput,
  database: DatabaseClient = prisma,
) {
  return database.ticketHistory.create({
    data: {
      ticketId: input.ticketId,
      changedById: input.changedById,
      action: input.action,
      oldValue: input.oldValue ?? "",
      newValue: input.newValue ?? "",
    },
  });
}

export function listTicketHistory(
  ticketId: number,
  database: DatabaseClient = prisma,
) {
  return database.ticketHistory.findMany({
    where: { ticketId },
    include: { changedBy: { select: safeUserSelection } },
    orderBy: { createdAt: "asc" },
  });
}
