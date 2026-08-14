import { Router } from "express";
import {
  currentUserController,
  developmentLoginController,
} from "../controllers/auth.controller.js";
import { requireAuthentication } from "../middleware/require-authentication.js";
import { notImplemented } from "../shared/not-implemented.js";

export const authRoutes = Router();

authRoutes.get("/auth/login", notImplemented("Start Microsoft university login"));
authRoutes.get("/auth/callback", notImplemented("Complete Microsoft login"));
authRoutes.post("/auth/dev-login", developmentLoginController);
authRoutes.get("/me", requireAuthentication, currentUserController);
