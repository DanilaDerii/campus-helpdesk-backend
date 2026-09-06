import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../generated/prisma/client.js";
import { logEvent, safeErrorDetails } from "../src/logging/logger.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const developmentUsers = [
  {
    microsoftOid: "dev-student-001",
    email: "student@helpdesk.local",
    displayName: "Development Student",
    role: Role.STUDENT,
  },
  {
    microsoftOid: "dev-faculty-001",
    email: "faculty@helpdesk.local",
    displayName: "Development Faculty",
    role: Role.FACULTY,
  },
  {
    microsoftOid: "dev-technician-001",
    email: "technician@helpdesk.local",
    displayName: "Development Technician",
    role: Role.TECHNICIAN,
  },
  {
    microsoftOid: "dev-admin-001",
    email: "admin@helpdesk.local",
    displayName: "Development Administrator",
    role: Role.ADMIN,
  },
] as const;

const ticketCategories = [
  {
    name: "IT Support",
    description: "Computers, accounts, network, and software",
  },
  {
    name: "Facilities",
    description: "Rooms, furniture, electricity, and campus facilities",
  },
  {
    name: "Registration",
    description: "Course registration problems",
  },
  {
    name: "General",
    description: "HelpDesk requests that do not match another category",
  },
] as const;

async function seed() {
  for (const user of developmentUsers) {
    await prisma.user.upsert({
      where: { microsoftOid: user.microsoftOid },
      update: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: true,
      },
      create: {
        ...user,
        isActive: true,
      },
    });
  }

  for (const category of ticketCategories) {
    await prisma.ticketCategory.upsert({
      where: { name: category.name },
      update: { description: category.description },
      create: category,
    });
  }

  logEvent("info", "database_seeded", {
    operation: "seed",
    users: developmentUsers.length,
    categories: ticketCategories.length,
  });
}

seed()
  .catch((error: unknown) => {
    logEvent("error", "database_seed_failed", {
      operation: "seed", ...safeErrorDetails(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
