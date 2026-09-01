import { Router } from "express";
import {
  createCategoryController,
  deleteCategoryController,
  listCategoriesController,
  updateCategoryController,
} from "../controllers/category.controller.js";
import { requireAuthentication } from "../middleware/require-authentication.js";

export const categoryRoutes = Router();

categoryRoutes.get("/", requireAuthentication, listCategoriesController);
categoryRoutes.post("/", requireAuthentication, createCategoryController);
categoryRoutes.patch(
  "/:categoryId",
  requireAuthentication,
  updateCategoryController,
);
categoryRoutes.delete(
  "/:categoryId",
  requireAuthentication,
  deleteCategoryController,
);
