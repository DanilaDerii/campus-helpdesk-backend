import { Router, type RequestHandler } from "express";
import { Role } from "../../generated/prisma/client.js";
import {
  getUsersForAdministrator,
  updateUserForAdministrator,
  type UserAdministrationUpdate,
} from "../services/users.js";
import { requireAuthentication } from "./guardrails/authentication.js";
import {
  hasOwnField,
  readBooleanValue,
  readEnumValue,
  readPositiveIntegerParameter,
  readRequestObject,
  requireAnyField,
  requireAuthenticatedUser,
} from "./guardrails/validation.js";

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

const listUsersHandler: RequestHandler = async (request, response) => {
  const users = await getUsersForAdministrator(
    requireAuthenticatedUser(request),
  );
  response.status(200).json({ users });
};

const updateUserHandler: RequestHandler = async (request, response) => {
  const user = await updateUserForAdministrator(
    requireAuthenticatedUser(request),
    readPositiveIntegerParameter(
      request.params.userId,
      "userId",
      "INVALID_USER_ID",
    ),
    readUserAccessUpdate(request.body),
  );
  response.status(200).json({ user });
};

export const userRoutes = Router();

userRoutes.use(requireAuthentication);
userRoutes.get("/", listUsersHandler);
userRoutes.patch("/:userId", updateUserHandler);
