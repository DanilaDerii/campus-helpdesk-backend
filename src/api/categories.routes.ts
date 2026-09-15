import { Router, type RequestHandler } from "express";
import { getCategories } from "../services/ticket/index.js";
import { requireAuthentication } from "./guardrails/authentication.js";

const listCategoriesHandler: RequestHandler = async (_request, response) => {
  const categories = await getCategories();
  response.status(200).json({ categories });
};

export const categoryRoutes = Router();

categoryRoutes.use(requireAuthentication);
categoryRoutes.get("/", listCategoriesHandler);
