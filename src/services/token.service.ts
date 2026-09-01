import "dotenv/config";
import { SignJWT, jwtVerify } from "jose";
import { configuredSecretProvider } from "../providers/secrets/configured-secret-provider.js";

const TOKEN_ISSUER = "campus-helpdesk";
const TOKEN_AUDIENCE = "campus-helpdesk-api";
const TOKEN_LIFETIME = "1h";
export const TOKEN_LIFETIME_SECONDS = 60 * 60;
const signingKey = new TextEncoder().encode(
  await configuredSecretProvider.get("JWT_SECRET"),
);

export interface VerifiedAccessToken {
  userId: number;
}

export class InvalidAccessTokenError extends Error {
  constructor() {
    super("The access token is missing, invalid, or expired");
    this.name = "InvalidAccessTokenError";
  }
}

/** Create a short-lived token containing only the local user ID. */
export function createAccessToken(userId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(signingKey);
}

/** Verify signature and expiry, then return the local user ID. */
export async function verifyAccessToken(
  token: string,
): Promise<VerifiedAccessToken> {
  try {
    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: ["HS256"],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });

    const userId = Number(payload.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new InvalidAccessTokenError();
    }

    return { userId };
  } catch (error: unknown) {
    if (error instanceof InvalidAccessTokenError) {
      throw error;
    }

    throw new InvalidAccessTokenError();
  }
}
