import { prisma, type DatabaseClient } from "../database/prisma.js";

export interface CategoryInput {
  name: string;
  description?: string;
}

export function listCategories(database: DatabaseClient = prisma) {
  return database.ticketCategory.findMany({
    orderBy: { name: "asc" },
  });
}

export function findCategoryById(
  id: number,
  database: DatabaseClient = prisma,
) {
  return database.ticketCategory.findUnique({ where: { id } });
}

export function findCategoryByName(
  name: string,
  database: DatabaseClient = prisma,
) {
  return database.ticketCategory.findUnique({ where: { name } });
}

export function createCategory(
  input: CategoryInput,
  database: DatabaseClient = prisma,
) {
  return database.ticketCategory.create({
    data: {
      name: input.name,
      description: input.description ?? "",
    },
  });
}

export function updateCategory(
  id: number,
  input: CategoryInput,
  database: DatabaseClient = prisma,
) {
  return database.ticketCategory.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? "",
    },
  });
}

/** The database rejects deletion when existing tickets use the category. */
export function deleteUnusedCategory(
  id: number,
  database: DatabaseClient = prisma,
) {
  return database.ticketCategory.delete({ where: { id } });
}

export function countTicketsUsingCategory(
  categoryId: number,
  database: DatabaseClient = prisma,
) {
  return database.ticket.count({ where: { categoryId } });
}
