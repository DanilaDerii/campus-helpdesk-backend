import { prisma } from "./prisma.js";

export function listCategories() {
  return prisma.ticketCategory.findMany({
    orderBy: { name: "asc" },
  });
}

export function findCategoryById(
  id: number,
) {
  return prisma.ticketCategory.findUnique({ where: { id } });
}
