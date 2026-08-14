import "dotenv/config";
import { SignJWT, jwtVerify } from "jose";

const TOKEN_ISSUER = "campus-helpdesk";
const TOKEN_AUDIENCE = "campus-helpdesk-api";
const TOKEN_LIFETIME = "1h";
export const TOKEN_LIFETIME_SECONDS = 60 * 60;

export interface VerifiedAccessToken {
  userId: number;
}

export class InvalidAccessTokenError extends Error {
  constructor() {
    super("The access token is missing, invalid, or expired");
    this.name = "InvalidAccessTokenError";
  }
}

function getSigningKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required to sign and verify access tokens");
  }

  return new TextEncoder().encode(secret);
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
    .sign(getSigningKey());
}

/** Verify signature and expiry, then return the local user ID. */
export async function verifyAccessToken(
  token: string,
): Promise<VerifiedAccessToken> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
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
