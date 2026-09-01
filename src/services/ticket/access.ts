import {
  Role,
  TicketStatus,
} from "../../../generated/prisma/client.js";
import type { AuthenticatedUser } from "../auth.service.js";
import { TicketServiceError } from "./errors.js";

interface TicketAccessFields {
  requesterId: number;
  assignedTechnicianId: number | null;
  status: TicketStatus;
}

const ticketCreatorRoles = new Set<Role>([
  Role.STUDENT,
  Role.FACULTY,
  Role.ADMIN,
]);

export function requireTicketCreationAccess(
  currentUser: AuthenticatedUser,
): void {
  if (!ticketCreatorRoles.has(currentUser.role)) {
    throw new TicketServiceError(
      "TICKET_CREATION_FORBIDDEN",
      "This role cannot create HelpDesk tickets",
    );
  }
}

export function requireTicketClaimAccess(
  currentUser: AuthenticatedUser,
): void {
  if (currentUser.role !== Role.TECHNICIAN) {
    throw new TicketServiceError(
      "TICKET_CLAIM_FORBIDDEN",
      "Only technicians can claim tickets",
    );
  }
}

export function requireTicketAssignmentAccess(
  currentUser: AuthenticatedUser,
): void {
  if (currentUser.role !== Role.ADMIN) {
    throw new TicketServiceError(
      "TICKET_ASSIGNMENT_FORBIDDEN",
      "Only administrators can assign technicians",
    );
  }
}

export function requireTicketStatusChangeAccess(
  currentUser: AuthenticatedUser,
  ticket: TicketAccessFields,
): void {
  if (
    currentUser.role !== Role.TECHNICIAN &&
    currentUser.role !== Role.ADMIN
  ) {
    throw new TicketServiceError(
      "TICKET_STATUS_FORBIDDEN",
      "Only technicians and administrators can change ticket status",
    );
  }

  if (
    currentUser.role === Role.TECHNICIAN &&
    ticket.assignedTechnicianId !== currentUser.id
  ) {
    throw new TicketServiceError(
      "TICKET_STATUS_FORBIDDEN",
      "Technicians can change only tickets assigned to them",
    );
  }
}

function userMayViewTicket(
  currentUser: AuthenticatedUser,
  ticket: TicketAccessFields,
): boolean {
  const isRequester = ticket.requesterId === currentUser.id;
  const isAssignedTechnician =
    currentUser.role === Role.TECHNICIAN &&
    ticket.assignedTechnicianId === currentUser.id;
  const isAvailableToTechnician =
    currentUser.role === Role.TECHNICIAN &&
    ticket.assignedTechnicianId === null &&
    ticket.status === TicketStatus.OPEN;

  return (
    currentUser.role === Role.ADMIN ||
    isRequester ||
    isAssignedTechnician ||
    isAvailableToTechnician
  );
}

export function requireTicketViewAccess(
  currentUser: AuthenticatedUser,
  ticket: TicketAccessFields,
): void {
  if (!userMayViewTicket(currentUser, ticket)) {
    throw new TicketServiceError(
      "TICKET_ACCESS_FORBIDDEN",
      "You do not have permission to view this ticket",
    );
  }
}
