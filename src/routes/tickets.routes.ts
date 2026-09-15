import { Router } from "express";
import {
  addTicketCommentController,
  assignTicketController,
  claimTicketController,
  createTicketController,
  getTicketController,
  listTicketsController,
  updateTicketStatusController,
} from "../controllers/ticket.controller.js";
import { requireAuthentication } from "../middleware/require-authentication.js";

export const ticketRoutes = Router();

ticketRoutes.use(requireAuthentication);
ticketRoutes.post("/", createTicketController);
ticketRoutes.get("/", listTicketsController);
ticketRoutes.get("/:ticketId", getTicketController);
ticketRoutes.post("/:ticketId/claim", claimTicketController);
ticketRoutes.patch("/:ticketId/status", updateTicketStatusController);
ticketRoutes.patch("/:ticketId/assignment", assignTicketController);
ticketRoutes.post("/:ticketId/comments", addTicketCommentController);
