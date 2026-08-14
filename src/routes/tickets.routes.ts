import { Router } from "express";
import {
  createTicketController,
  getTicketController,
  listTicketsController,
} from "../controllers/ticket.controller.js";
import { requireAuthentication } from "../middleware/require-authentication.js";
import { notImplemented } from "../shared/not-implemented.js";

export const ticketRoutes = Router();

ticketRoutes.post("/", requireAuthentication, createTicketController);
ticketRoutes.get("/", requireAuthentication, listTicketsController);
ticketRoutes.get("/:ticketId", requireAuthentication, getTicketController);
ticketRoutes.post("/:ticketId/claim", notImplemented("Claim an open ticket"));
ticketRoutes.patch("/:ticketId/status", notImplemented("Update ticket status"));
ticketRoutes.patch(
  "/:ticketId/assignment",
  notImplemented("Assign or reassign a technician"),
);
ticketRoutes.post("/:ticketId/comments", notImplemented("Add a ticket comment"));
ticketRoutes.get("/:ticketId/comments", notImplemented("List ticket comments"));
ticketRoutes.get("/:ticketId/history", notImplemented("View ticket history"));
