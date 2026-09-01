import { prisma, type DatabaseClient } from "../database/prisma.js";

const safeAuthorSelection = {
  id: true,
  email: true,
  displayName: true,
  role: true,
} as const;

export function createTicketComment(
  ticketId: number,
  authorId: number,
  message: string,
  database: DatabaseClient = prisma,
) {
  return database.ticketComment.create({
    data: { ticketId, authorId, message },
    include: { author: { select: safeAuthorSelection } },
  });
}

export function listTicketComments(
  ticketId: number,
  database: DatabaseClient = prisma,
) {
  return database.ticketComment.findMany({
    where: { ticketId },
    include: { author: { select: safeAuthorSelection } },
    orderBy: { createdAt: "asc" },
  });
}
