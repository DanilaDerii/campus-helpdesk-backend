import { Router } from "express";
import { notImplemented } from "../../errors/not-implemented.js";

export const alexAuthRoutes = Router();

alexAuthRoutes.get(
  "/login",
  notImplemented("Start Microsoft university login"),
);
alexAuthRoutes.get(
  "/callback",
  notImplemented("Complete Microsoft login"),
);
