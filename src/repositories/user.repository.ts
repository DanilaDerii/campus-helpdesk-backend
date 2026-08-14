import type { Role } from "../generated/prisma/client.js";
import { prisma, type DatabaseClient } from "../database/prisma.js";

export interface IdentityUserInput {
  microsoftOid: string;
  email: string;
  displayName: string;
}

export interface UserAccessUpdate {
  role?: Role;
  isActive?: boolean;
}

export function findUserById(id: number, database: DatabaseClient = prisma) {
  return database.user.findUnique({ where: { id } });
}

export function findUserByEmail(
  email: string,
  database: DatabaseClient = prisma,
) {
  return database.user.findUnique({ where: { email } });
}

export function findUserByMicrosoftOid(
  microsoftOid: string,
  database: DatabaseClient = prisma,
) {
  return database.user.findUnique({ where: { microsoftOid } });
}

export function listUsers(database: DatabaseClient = prisma) {
  return database.user.findMany({
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
  });
}

/** Create the local user on first identity login, or refresh basic identity data. */
export function upsertUserFromIdentity(
  input: IdentityUserInput,
  database: DatabaseClient = prisma,
) {
  return database.user.upsert({
    where: { microsoftOid: input.microsoftOid },
    update: {
      email: input.email,
      displayName: input.displayName,
    },
    create: {
      microsoftOid: input.microsoftOid,
      email: input.email,
      displayName: input.displayName,
    },
  });
}

/** Administration may change access, but users are not deleted. */
export function updateUserAccess(
  id: number,
  update: UserAccessUpdate,
  database: DatabaseClient = prisma,
) {
  return database.user.update({
    where: { id },
    data: update,
  });
}
