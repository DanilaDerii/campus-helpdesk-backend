import { Router } from "express";
import {
  currentUserController,
  developmentLoginController,
  logoutController,
} from "../controllers/auth.controller.js";
import {
  requireAuthentication,
  requireSameOrigin,
} from "../middleware/require-authentication.js";

export const authRoutes = Router();

authRoutes.post("/auth/dev-login", developmentLoginController);
authRoutes.post("/auth/logout", requireSameOrigin, logoutController);
authRoutes.get("/me", requireAuthentication, currentUserController);
