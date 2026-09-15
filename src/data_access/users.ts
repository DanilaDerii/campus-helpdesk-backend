import type { Role } from "../../generated/prisma/client.js";
import { prisma } from "./prisma.js";

export interface IdentityUserInput {
  microsoftOid: string;
  email: string;
  displayName: string;
}

export interface UserAccessUpdate {
  role?: Role;
  isActive?: boolean;
}

const managedUserSelection = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function findUserById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export function findUserByEmail(
  email: string,
) {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserByMicrosoftOid(
  microsoftOid: string,
) {
  return prisma.user.findUnique({ where: { microsoftOid } });
}

export function listUsers() {
  return prisma.user.findMany({
    select: managedUserSelection,
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
  });
}

/** Create the local user on first identity login, or refresh basic identity data. */
export function upsertUserFromIdentity(
  input: IdentityUserInput,
) {
  return prisma.user.upsert({
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
) {
  return prisma.user.update({
    where: { id },
    data: update,
    select: managedUserSelection,
  });
}
