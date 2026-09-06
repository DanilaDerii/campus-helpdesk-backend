import { Router } from "express";
import { alexAuthRoutes } from "../alex/identity/index.js";
import { authRoutes } from "./auth.routes.js";
import { categoryRoutes } from "./categories.routes.js";
import { ticketRoutes } from "./tickets.routes.js";
import { userRoutes } from "./users.routes.js";

export const apiRoutes = Router();

apiRoutes.use("/api/v1/auth", alexAuthRoutes);
apiRoutes.use("/api/v1", authRoutes);
apiRoutes.use("/api/v1/categories", categoryRoutes);
apiRoutes.use("/api/v1/tickets", ticketRoutes);
apiRoutes.use("/api/v1/users", userRoutes);
