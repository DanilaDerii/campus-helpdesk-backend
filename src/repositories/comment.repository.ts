import { prisma, type DatabaseClient } from "../database/prisma.js";
import { safeUserSelection } from "./user-selection.js";

export function createTicketComment(
  ticketId: number,
  authorId: number,
  message: string,
  database: DatabaseClient = prisma,
) {
  return database.ticketComment.create({
    data: { ticketId, authorId, message },
    include: { author: { select: safeUserSelection } },
  });
}

export function listTicketComments(
  ticketId: number,
  database: DatabaseClient = prisma,
) {
  return database.ticketComment.findMany({
    where: { ticketId },
    include: { author: { select: safeUserSelection } },
    orderBy: { createdAt: "asc" },
  });
}
