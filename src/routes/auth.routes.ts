import { Router } from "express";
import { notImplemented } from "../shared/not-implemented.js";

export const authRoutes = Router();

authRoutes.get("/auth/login", notImplemented("Start Microsoft university login"));
authRoutes.get("/auth/callback", notImplemented("Complete Microsoft login"));
authRoutes.post(
  "/auth/dev-login",
  notImplemented("Development-only login; disable this route in production"),
);
authRoutes.get("/me", notImplemented("Return the current user and role"));
