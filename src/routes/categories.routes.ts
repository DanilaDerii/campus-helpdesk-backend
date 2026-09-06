import { Router } from "express";
import {
  createCategoryController,
  deleteCategoryController,
  listCategoriesController,
  updateCategoryController,
} from "../controllers/category.controller.js";
import { requireAuthentication } from "../middleware/require-authentication.js";

export const categoryRoutes = Router();

categoryRoutes.use(requireAuthentication);
categoryRoutes.get("/", listCategoriesController);
categoryRoutes.post("/", createCategoryController);
categoryRoutes.patch("/:categoryId", updateCategoryController);
categoryRoutes.delete("/:categoryId", deleteCategoryController);
