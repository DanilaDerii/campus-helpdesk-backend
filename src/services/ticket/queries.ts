import { Role } from "../../../generated/prisma/client.js";
import {
  findTicketById,
  listAllTickets,
  listTicketsByRequester,
  listTicketsVisibleToTechnician,
} from "../../data_access/index.js";
import type { AuthenticatedUser } from "../auth/index.js";
import { requireTicketViewAccess } from "./access.js";
import { TicketServiceError } from "./errors.js";

export function listTicketsForUser(currentUser: AuthenticatedUser) {
  if (currentUser.role === Role.ADMIN) {
    return listAllTickets();
  }

  if (currentUser.role === Role.TECHNICIAN) {
    return listTicketsVisibleToTechnician(currentUser.id);
  }

  return listTicketsByRequester(currentUser.id);
}

export async function getTicketForUser(
  currentUser: AuthenticatedUser,
  ticketId: number,
) {
  const ticket = await findTicketById(ticketId);

  if (!ticket) {
    throw new TicketServiceError(
      "TICKET_NOT_FOUND",
      "The requested ticket does not exist",
    );
  }

  requireTicketViewAccess(currentUser, ticket);

  return ticket;
}
