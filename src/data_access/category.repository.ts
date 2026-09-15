import { prisma, type DatabaseClient } from "../database/prisma.js";

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
