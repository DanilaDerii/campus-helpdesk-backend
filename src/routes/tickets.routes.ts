import { Router } from "express";
import { notImplemented } from "../shared/not-implemented.js";

export const ticketRoutes = Router();

ticketRoutes.post("/", notImplemented("Create a ticket"));
ticketRoutes.get("/", notImplemented("List tickets allowed for the current user"));
ticketRoutes.get("/:ticketId", notImplemented("View one allowed ticket"));
ticketRoutes.post("/:ticketId/claim", notImplemented("Claim an open ticket"));
ticketRoutes.patch("/:ticketId/status", notImplemented("Update ticket status"));
ticketRoutes.patch(
  "/:ticketId/assignment",
  notImplemented("Assign or reassign a technician"),
);
ticketRoutes.post("/:ticketId/comments", notImplemented("Add a ticket comment"));
ticketRoutes.get("/:ticketId/comments", notImplemented("List ticket comments"));
ticketRoutes.get("/:ticketId/history", notImplemented("View ticket history"));
