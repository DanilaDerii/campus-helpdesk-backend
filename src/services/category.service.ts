import { Role } from "../../generated/prisma/client.js";
import { runInTransaction } from "../database/prisma.js";
import {
  countTicketsUsingCategory,
  createCategory,
  deleteUnusedCategory,
  findCategoryById,
  findCategoryByName,
  listCategories,
  updateCategory,
} from "../repositories/index.js";
import type { AuthenticatedUser } from "./auth.service.js";

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
}

export type CategoryServiceErrorCode =
  | "CATEGORY_MANAGEMENT_FORBIDDEN"
  | "CATEGORY_NOT_FOUND"
  | "CATEGORY_NAME_CONFLICT"
  | "CATEGORY_IN_USE";

export class CategoryServiceError extends Error {
  constructor(
    public readonly code: CategoryServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CategoryServiceError";
  }
}

function requireCategoryAdministrator(currentUser: AuthenticatedUser): void {
  if (currentUser.role !== Role.ADMIN) {
    throw new CategoryServiceError(
      "CATEGORY_MANAGEMENT_FORBIDDEN",
      "Only administrators can manage ticket categories",
    );
  }
}

export function getCategories() {
  return listCategories();
}

export async function createTicketCategory(
  currentUser: AuthenticatedUser,
  input: CreateCategoryInput,
) {
  requireCategoryAdministrator(currentUser);

  return runInTransaction(async (transaction) => {
    const categoryWithName = await findCategoryByName(input.name, transaction);

    if (categoryWithName) {
      throw new CategoryServiceError(
        "CATEGORY_NAME_CONFLICT",
        "A ticket category with this name already exists",
      );
    }

    return createCategory(input, transaction);
  });
}

export async function updateTicketCategory(
  currentUser: AuthenticatedUser,
  categoryId: number,
  input: UpdateCategoryInput,
) {
  requireCategoryAdministrator(currentUser);

  return runInTransaction(async (transaction) => {
    const category = await findCategoryById(categoryId, transaction);

    if (!category) {
      throw new CategoryServiceError(
        "CATEGORY_NOT_FOUND",
        "The requested ticket category does not exist",
      );
    }

    if (input.name !== undefined && input.name !== category.name) {
      const categoryWithName = await findCategoryByName(input.name, transaction);

      if (categoryWithName) {
        throw new CategoryServiceError(
          "CATEGORY_NAME_CONFLICT",
          "A ticket category with this name already exists",
        );
      }
    }

    return updateCategory(
      categoryId,
      {
        name: input.name ?? category.name,
        description: input.description ?? category.description,
      },
      transaction,
    );
  });
}

export async function removeTicketCategory(
  currentUser: AuthenticatedUser,
  categoryId: number,
) {
  requireCategoryAdministrator(currentUser);

  return runInTransaction(async (transaction) => {
    const category = await findCategoryById(categoryId, transaction);

    if (!category) {
      throw new CategoryServiceError(
        "CATEGORY_NOT_FOUND",
        "The requested ticket category does not exist",
      );
    }

    const ticketCount = await countTicketsUsingCategory(
      categoryId,
      transaction,
    );

    if (ticketCount > 0) {
      throw new CategoryServiceError(
        "CATEGORY_IN_USE",
        "A category used by existing tickets cannot be deleted",
      );
    }

    return deleteUnusedCategory(categoryId, transaction);
  });
}
