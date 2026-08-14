import { Router } from "express";
import { listCategoriesController } from "../controllers/category.controller.js";
import { requireAuthentication } from "../middleware/require-authentication.js";
import { notImplemented } from "../shared/not-implemented.js";

export const categoryRoutes = Router();

categoryRoutes.get("/", requireAuthentication, listCategoriesController);
categoryRoutes.post("/", notImplemented("Create a ticket category"));
categoryRoutes.patch("/:categoryId", notImplemented("Update a ticket category"));
categoryRoutes.delete(
  "/:categoryId",
  notImplemented("Remove or deactivate a ticket category"),
);
