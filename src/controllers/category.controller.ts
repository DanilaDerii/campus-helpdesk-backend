import type { RequestHandler } from "express";
import { getCategories } from "../services/ticket/index.js";

export const listCategoriesController: RequestHandler = async (
  _request,
  response,
) => {
  const categories = await getCategories();
  response.status(200).json({ categories });
};
