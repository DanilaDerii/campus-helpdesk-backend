import { Role } from "../../generated/prisma/client.js";
import {
  findUserById,
  listUsers,
  updateUserAccess,
  type UserAccessUpdate,
} from "../repositories/index.js";
import type { AuthenticatedUser } from "./auth.service.js";

export type UserAdministrationUpdate = UserAccessUpdate;

export type UserAdministrationErrorCode =
  | "USER_MANAGEMENT_FORBIDDEN"
  | "USER_NOT_FOUND"
  | "SELF_ACCESS_CHANGE_FORBIDDEN";

export class UserAdministrationError extends Error {
  constructor(
    public readonly code: UserAdministrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UserAdministrationError";
  }
}

function requireUserAdministrator(currentUser: AuthenticatedUser): void {
  if (currentUser.role !== Role.ADMIN) {
    throw new UserAdministrationError(
      "USER_MANAGEMENT_FORBIDDEN",
      "Only administrators can manage users",
    );
  }
}

export function getUsersForAdministrator(currentUser: AuthenticatedUser) {
  requireUserAdministrator(currentUser);
  return listUsers();
}

export async function updateUserForAdministrator(
  currentUser: AuthenticatedUser,
  userId: number,
  update: UserAdministrationUpdate,
) {
  requireUserAdministrator(currentUser);

  const changesOwnAccess =
    currentUser.id === userId &&
    (update.isActive === false ||
      (update.role !== undefined && update.role !== Role.ADMIN));

  if (changesOwnAccess) {
    throw new UserAdministrationError(
      "SELF_ACCESS_CHANGE_FORBIDDEN",
      "Administrators cannot deactivate or remove their own administrator access",
    );
  }

  const user = await findUserById(userId);

  if (!user) {
    throw new UserAdministrationError(
      "USER_NOT_FOUND",
      "The requested user does not exist",
    );
  }

  return updateUserAccess(userId, update);
}
