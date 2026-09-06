export type TicketServiceErrorCode =
  | "TICKET_CREATION_FORBIDDEN"
  | "CATEGORY_NOT_FOUND"
  | "TICKET_NOT_FOUND"
  | "TICKET_ACCESS_FORBIDDEN"
  | "TICKET_CLAIM_FORBIDDEN"
  | "TICKET_ASSIGNMENT_FORBIDDEN"
  | "TICKET_ASSIGNMENT_CONFLICT"
  | "TICKET_ALREADY_ASSIGNED"
  | "TICKET_NOT_CLAIMABLE"
  | "TICKET_STATUS_FORBIDDEN"
  | "INVALID_STATUS_TRANSITION"
  | "TICKET_STATUS_CONFLICT"
  | "TECHNICIAN_NOT_FOUND"
  | "INVALID_TECHNICIAN"
  | "TICKET_ALREADY_RESOLVED";

export class TicketServiceError extends Error {
  constructor(
    public readonly code: TicketServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TicketServiceError";
  }
}
