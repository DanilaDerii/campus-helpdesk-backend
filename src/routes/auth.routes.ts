import { Router } from "express";
import {
  currentUserController,
  developmentLoginController,
} from "../controllers/auth.controller.js";
import { requireAuthentication } from "../middleware/require-authentication.js";

export const authRoutes = Router();

authRoutes.post("/auth/dev-login", developmentLoginController);
authRoutes.get("/me", requireAuthentication, currentUserController);
