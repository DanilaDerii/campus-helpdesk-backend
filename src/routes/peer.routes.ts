import { Router } from "express";
import { notImplemented } from "../shared/not-implemented.js";

export const peerRoutes = Router();

// Real integration with the other group is intentionally deferred.
peerRoutes.post(
  "/tickets",
  notImplemented("Create a HelpDesk ticket from the EduCore peer API"),
);
