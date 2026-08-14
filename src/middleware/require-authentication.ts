import type { RequestHandler } from "express";
import { authenticateAccessToken } from "../services/auth.service.js";
import { InvalidAccessTokenError } from "../services/token.service.js";

function readBearerToken(authorizationHeader: string | undefined): string {
  const parts = authorizationHeader?.trim().split(/\s+/) ?? [];

  if (
    parts.length !== 2 ||
    parts[0]?.toLowerCase() !== "bearer" ||
    !parts[1]
  ) {
    throw new InvalidAccessTokenError();
  }

  return parts[1];
}

export const requireAuthentication: RequestHandler = async (
  request,
  _response,
  next,
) => {
  try {
    const token = readBearerToken(request.get("authorization"));
    request.authenticatedUser = await authenticateAccessToken(token);
    next();
  } catch (error: unknown) {
    next(error);
  }
};
