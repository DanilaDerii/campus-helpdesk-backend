import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type Prisma,
} from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to connect to PostgreSQL");
}

const globalDatabase = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/** One shared Prisma connection pool for the whole backend process. */
export const prisma = globalDatabase.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalDatabase.prisma = prisma;
}

export type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export function runInTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(operation);
}

export function disconnectDatabase(): Promise<void> {
  return prisma.$disconnect();
}
