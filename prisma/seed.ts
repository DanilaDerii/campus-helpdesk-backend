import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../generated/prisma/client.js";

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

  console.log(`Seeded ${developmentUsers.length} development users`);
}

seed()
  .catch(() => {
    console.error("Database seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
