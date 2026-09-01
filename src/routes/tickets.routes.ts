import { Router } from "express";
import {
  addTicketCommentController,
  assignTicketController,
  claimTicketController,
  createTicketController,
  getTicketController,
  listTicketCommentsController,
  listTicketHistoryController,
  listTicketsController,
  updateTicketStatusController,
} from "../controllers/ticket.controller.js";
import { requireAuthentication } from "../middleware/require-authentication.js";

export const ticketRoutes = Router();

ticketRoutes.post("/", requireAuthentication, createTicketController);
ticketRoutes.get("/", requireAuthentication, listTicketsController);
ticketRoutes.get("/:ticketId", requireAuthentication, getTicketController);
ticketRoutes.post(
  "/:ticketId/claim",
  requireAuthentication,
  claimTicketController,
);
ticketRoutes.patch(
  "/:ticketId/status",
  requireAuthentication,
  updateTicketStatusController,
);
ticketRoutes.patch(
  "/:ticketId/assignment",
  requireAuthentication,
  assignTicketController,
);
ticketRoutes.post(
  "/:ticketId/comments",
  requireAuthentication,
  addTicketCommentController,
);
ticketRoutes.get(
  "/:ticketId/comments",
  requireAuthentication,
  listTicketCommentsController,
);
ticketRoutes.get(
  "/:ticketId/history",
  requireAuthentication,
  listTicketHistoryController,
);
