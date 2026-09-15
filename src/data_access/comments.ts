import { prisma } from "./prisma.js";
import { safeUserSelection } from "./user-fields.js";

export function createTicketComment(
  ticketId: number,
  authorId: number,
  message: string,
) {
  return prisma.ticketComment.create({
    data: { ticketId, authorId, message },
    include: { author: { select: safeUserSelection } },
  });
}
