export { getCategories } from "./categories.js";
export {
  assignTicketTechnician,
  changeTicketStatus,
  claimTicket,
  createTicket,
  type CreateTicketInput,
} from "./commands.js";
export {
  addTicketComment,
} from "./comments.js";
export {
  TicketServiceError,
  type TicketServiceErrorCode,
} from "./errors.js";
export {
  getTicketForUser,
  listTicketsForUser,
} from "./queries.js";
