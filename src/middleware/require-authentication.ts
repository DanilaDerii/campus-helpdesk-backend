import type { RequestHandler } from "express";
import { HttpError } from "../errors/http-error.js";
import { readAuthenticationCookie } from "../services/auth-cookie.js";
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

export function requireSameOriginRequest(
  request: Parameters<RequestHandler>[0],
): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;

  const origin = request.get("origin");
  const host = request.get("host");
  const expectedOrigin = host ? `${request.protocol}://${host}` : undefined;

  if (!origin || origin !== expectedOrigin) {
    throw new HttpError(
      403,
      "INVALID_REQUEST_ORIGIN",
      "Cookie-authenticated changes require the same website origin",
    );
  }
}

export const requireSameOrigin: RequestHandler = (request, _response, next) => {
  try {
    requireSameOriginRequest(request);
    next();
  } catch (error: unknown) {
    next(error);
  }
};

export const requireAuthentication: RequestHandler = async (
  request,
  _response,
  next,
) => {
  try {
    const authorizationHeader = request.get("authorization");
    const cookieToken = authorizationHeader
      ? undefined : readAuthenticationCookie(request.get("cookie"));
    const token = authorizationHeader
      ? readBearerToken(authorizationHeader)
      : cookieToken;

    if (!token) {
      throw new InvalidAccessTokenError();
    }

    if (cookieToken) {
      requireSameOriginRequest(request);
    }

    request.authenticatedUser = await authenticateAccessToken(token);
    next();
  } catch (error: unknown) {
    next(error);
  }
};
