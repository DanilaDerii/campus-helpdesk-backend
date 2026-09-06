import { Router } from "express";
import {
  listUsersController,
  updateUserController,
} from "../controllers/user.controller.js";
import { requireAuthentication } from "../middleware/require-authentication.js";

export const userRoutes = Router();

userRoutes.use(requireAuthentication);
userRoutes.get("/", listUsersController);
userRoutes.patch("/:userId", updateUserController);
