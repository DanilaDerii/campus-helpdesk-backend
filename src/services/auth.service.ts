import type { Role } from "../../generated/prisma/client.js";
import { DevelopmentIdentityProvider } from "../providers/identity/development-identity-provider.js";
import type { ExternalIdentity } from "../providers/identity/identity-provider.js";
import { runInTransaction } from "../database/prisma.js";
import {
  findUserByEmail,
  findUserById,
  findUserByMicrosoftOid,
  upsertUserFromIdentity,
} from "../repositories/index.js";
import {
  createAccessToken,
  TOKEN_LIFETIME_SECONDS,
  verifyAccessToken,
} from "./token.service.js";

export type AuthenticationErrorCode =
  | "DEVELOPMENT_LOGIN_DISABLED"
  | "INVALID_DEVELOPMENT_USER"
  | "EXTERNAL_IDENTITY_CONFLICT"
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

export interface LoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  user: AuthenticatedUser;
}

export type DevelopmentLoginResult = LoginResult;

const developmentIdentityProvider = new DevelopmentIdentityProvider();

function toAuthenticatedUser(user: AuthenticatedUser): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

async function createLoginResult(user: AuthenticatedUser): Promise<LoginResult> {
  return {
    accessToken: await createAccessToken(user.id),
    tokenType: "Bearer",
    expiresInSeconds: TOKEN_LIFETIME_SECONDS,
    user: toAuthenticatedUser(user),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

/** Development-only login for the seeded local accounts. */
export async function developmentLogin(
  email: string,
): Promise<DevelopmentLoginResult> {
  if (process.env.NODE_ENV === "production") {
    throw new AuthenticationError(
      "DEVELOPMENT_LOGIN_DISABLED",
      "Development login is disabled in production",
    );
  }

  const identity = await developmentIdentityProvider.completeLogin({ email });
  const user = await findUserByEmail(identity.email);

  if (!user) {
    throw new AuthenticationError(
      "INVALID_DEVELOPMENT_USER",
      "No development user exists for this email",
    );
  }

  if (!user.isActive) {
    throw new AuthenticationError("USER_INACTIVE", "This user is inactive");
  }

  return createLoginResult(user);
}

/**
 * Resolve a verified external identity to a local user and issue the same JWT
 * response used by development login. Roles and active state remain controlled
 * by PostgreSQL; an email address never links two different Microsoft users.
 */
export async function completeExternalLogin(
  identity: ExternalIdentity,
): Promise<LoginResult> {
  let user: AuthenticatedUser;

  try {
    user = await runInTransaction(async (transaction) => {
      const existingUser = await findUserByMicrosoftOid(
        identity.microsoftOid,
        transaction,
      );

      if (existingUser && !existingUser.isActive) {
        throw new AuthenticationError("USER_INACTIVE", "This user is inactive");
      }

      const emailOwner = await findUserByEmail(identity.email, transaction);

      if (emailOwner && emailOwner.microsoftOid !== identity.microsoftOid) {
        throw new AuthenticationError(
          "EXTERNAL_IDENTITY_CONFLICT",
          "This email address belongs to a different local account",
        );
      }

      return upsertUserFromIdentity(identity, transaction);
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw new AuthenticationError(
        "EXTERNAL_IDENTITY_CONFLICT",
        "This Microsoft identity conflicts with an existing local account",
      );
    }

    throw error;
  }

  return createLoginResult(user);
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
