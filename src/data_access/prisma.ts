import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { getSecret } from "../integrations/secrets/secrets.js";

const connectionString = await getSecret("DATABASE_URL");

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

export function disconnectDatabase(): Promise<void> {
  return prisma.$disconnect();
}

export async function checkDatabaseReadiness(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
