import type { RequestHandler } from "express";
import { Role } from "../../generated/prisma/client.js";
import {
  getUsersForAdministrator,
  updateUserForAdministrator,
  type UserAdministrationUpdate,
} from "../services/user.service.js";
import {
  hasOwnField,
  readBooleanValue,
  readEnumValue,
  readPositiveIntegerParameter,
  readRequestObject,
  requireAnyField,
  requireAuthenticatedUser,
} from "../validation/request-validation.js";

function readUserAccessUpdate(body: unknown): UserAdministrationUpdate {
  const requestBody = readRequestObject(body);
  requireAnyField(requestBody, ["role", "isActive"]);
  const hasRole = hasOwnField(requestBody, "role");
  const hasIsActive = hasOwnField(requestBody, "isActive");
  const roleValues = Object.values(Role);

  return {
    ...(hasRole
      ? { role: readEnumValue(requestBody.role, "role", roleValues) }
      : {}),
    ...(hasIsActive
      ? { isActive: readBooleanValue(requestBody.isActive, "isActive") }
      : {}),
  };
}

export const listUsersController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const users = await getUsersForAdministrator(currentUser);
  response.status(200).json({ users });
};

export const updateUserController: RequestHandler = async (
  request,
  response,
) => {
  const currentUser = requireAuthenticatedUser(request);
  const user = await updateUserForAdministrator(
    currentUser,
    readPositiveIntegerParameter(
      request.params.userId,
      "userId",
      "INVALID_USER_ID",
    ),
    readUserAccessUpdate(request.body),
  );

  response.status(200).json({ user });
};
