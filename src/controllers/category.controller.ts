import type { RequestHandler } from "express";
import {
  createTicketCategory,
  getCategories,
  removeTicketCategory,
  updateTicketCategory,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "../services/category.service.js";
import {
  hasOwnField,
  readPositiveIntegerParameter,
  readRequestObject,
  readStringValue,
  requireAnyField,
  requireAuthenticatedUser,
} from "../validation/request-validation.js";

function readCreateCategoryBody(body: unknown): CreateCategoryInput {
  const requestBody = readRequestObject(body);

  return {
    name: readStringValue(requestBody.name, "Category name", {
      maximumLength: 100,
    }),
    ...(requestBody.description === undefined
      ? {}
      : {
          description: readStringValue(
            requestBody.description,
            "Category description",
            { allowEmpty: true, maximumLength: 500 },
          ),
        }),
  };
}

function readUpdateCategoryBody(body: unknown): UpdateCategoryInput {
  const requestBody = readRequestObject(body);
  requireAnyField(requestBody, ["name", "description"]);
  const hasName = hasOwnField(requestBody, "name");
  const hasDescription = hasOwnField(requestBody, "description");

  return {
    ...(hasName
      ? {
          name: readStringValue(requestBody.name, "Category name", {
            maximumLength: 100,
          }),
        }
      : {}),
    ...(hasDescription
      ? {
          description: readStringValue(
            requestBody.description,
            "Category description",
            { allowEmpty: true, maximumLength: 500 },
          ),
        }
      : {}),
  };
}

export const listCategoriesController: RequestHandler = async (
  _request,
  response,
) => {
  const categories = await getCategories();
  response.status(200).json({ categories });
};

export const createCategoryController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const category = await createTicketCategory(
    currentUser,
    readCreateCategoryBody(request.body),
  );

  response.status(201).json({ category });
};

export const updateCategoryController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const category = await updateTicketCategory(
    currentUser,
    readPositiveIntegerParameter(
      request.params.categoryId,
      "categoryId",
      "INVALID_CATEGORY_ID",
    ),
    readUpdateCategoryBody(request.body),
  );

  response.status(200).json({ category });
};

export const deleteCategoryController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  await removeTicketCategory(
    currentUser,
    readPositiveIntegerParameter(
      request.params.categoryId,
      "categoryId",
      "INVALID_CATEGORY_ID",
    ),
  );

  response.status(204).send();
};
