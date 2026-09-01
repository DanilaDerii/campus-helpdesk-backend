import { Router } from "express";
import { notImplemented } from "../../errors/not-implemented.js";

export const andreiPeerRoutes = Router();

// Andrei will replace this with the agreed EduCore peer implementation.
andreiPeerRoutes.post(
  "/tickets",
  notImplemented("Create a HelpDesk ticket from the EduCore peer API"),
);
