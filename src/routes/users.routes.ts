import { Router } from "express";
import { notImplemented } from "../shared/not-implemented.js";

export const userRoutes = Router();

userRoutes.get("/", notImplemented("Administrator user list"));
userRoutes.patch(
  "/:userId",
  notImplemented("Change a user's role or active state"),
);
