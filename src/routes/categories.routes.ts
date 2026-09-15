import { Router } from "express";
import { listCategoriesController } from "../controllers/category.controller.js";
import { requireAuthentication } from "../middleware/require-authentication.js";

export const categoryRoutes = Router();

categoryRoutes.use(requireAuthentication);
categoryRoutes.get("/", listCategoriesController);
