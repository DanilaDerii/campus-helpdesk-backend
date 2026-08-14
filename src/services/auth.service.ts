import type { Role } from "../generated/prisma/client.js";
import { findUserByEmail, findUserById } from "../repositories/index.js";
import {
  createAccessToken,
  TOKEN_LIFETIME_SECONDS,
  verifyAccessToken,
} from "./token.service.js";

export type AuthenticationErrorCode =
  | "DEVELOPMENT_LOGIN_DISABLED"
  | "INVALID_DEVELOPMENT_USER"
  | "USER_INACTIVE";

export class AuthenticationError extends Error {
  constructor(
    public readonly code: AuthenticationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  displayName: string;
  role: Role;
}

export interface DevelopmentLoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  user: AuthenticatedUser;
}

function toAuthenticatedUser(user: AuthenticatedUser): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

/** Temporary login used only until Microsoft identity integration is added. */
export async function developmentLogin(
  email: string,
): Promise<DevelopmentLoginResult> {
  if (process.env.NODE_ENV === "production") {
    throw new AuthenticationError(
      "DEVELOPMENT_LOGIN_DISABLED",
      "Development login is disabled in production",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = normalizedEmail ? await findUserByEmail(normalizedEmail) : null;

  if (!user) {
    throw new AuthenticationError(
      "INVALID_DEVELOPMENT_USER",
      "No development user exists for this email",
    );
  }

  if (!user.isActive) {
    throw new AuthenticationError("USER_INACTIVE", "This user is inactive");
  }

  return {
    accessToken: await createAccessToken(user.id),
    tokenType: "Bearer",
    expiresInSeconds: TOKEN_LIFETIME_SECONDS,
    user: toAuthenticatedUser(user),
  };
}

/** Verify a JWT and load the current role and active state from PostgreSQL. */
export async function authenticateAccessToken(
  accessToken: string,
): Promise<AuthenticatedUser> {
  const { userId } = await verifyAccessToken(accessToken);
  const user = await findUserById(userId);

  if (!user) {
    throw new AuthenticationError(
      "INVALID_DEVELOPMENT_USER",
      "The token user no longer exists",
    );
  }

  if (!user.isActive) {
    throw new AuthenticationError("USER_INACTIVE", "This user is inactive");
  }

  return toAuthenticatedUser(user);
}
