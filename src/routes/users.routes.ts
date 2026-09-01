import { Router } from "express";
import {
  listUsersController,
  updateUserController,
} from "../controllers/user.controller.js";
import { requireAuthentication } from "../middleware/require-authentication.js";

export const userRoutes = Router();

userRoutes.get("/", requireAuthentication, listUsersController);
userRoutes.patch(
  "/:userId",
  requireAuthentication,
  updateUserController,
);
