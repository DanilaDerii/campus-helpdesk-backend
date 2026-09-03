import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { configuredSecretProvider } from "../../providers/secrets/configured-secret-provider.js";

/**
 * OAuth state handling for the Microsoft login flow.
 *
 * The state parameter proves that a callback belongs to a sign-in this server
 * actually started, which is what prevents login cross-site request forgery.
 * The application has no session store, so instead of keeping state in memory
 * it is encoded as a short-lived signed token. That is stateless, survives a
 * service restart in the middle of a login, and needs no extra dependency.
 *
 * A distinct audience keeps these tokens from being usable as access tokens
 * even though both are signed with the same secret.
 */
const STATE_ISSUER = "campus-helpdesk";
const STATE_AUDIENCE = "campus-helpdesk-login-state";
const STATE_LIFETIME = "10m";

let signingKey: Promise<Uint8Array> | undefined;

function getSigningKey(): Promise<Uint8Array> {
  if (!signingKey) {
    const lookup = configuredSecretProvider
      .get("JWT_SECRET")
      .then((secret) => new TextEncoder().encode(secret));

    signingKey = lookup;

    void lookup.catch(() => {
      if (signingKey === lookup) {
        signingKey = undefined;
      }
    });
  }

  return signingKey;
}

export class InvalidLoginStateError extends Error {
  constructor() {
    super("The login state is missing, invalid, or expired");
    this.name = "InvalidLoginStateError";
  }
}

/** Create the opaque state value to hand to Microsoft. */
export async function createLoginState(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setJti(randomUUID())
    .setIssuer(STATE_ISSUER)
    .setAudience(STATE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(STATE_LIFETIME)
    .sign(await getSigningKey());
}

/** Reject a callback whose state this server did not issue, or that expired. */
export async function verifyLoginState(state: unknown): Promise<void> {
  if (typeof state !== "string" || state === "") {
    throw new InvalidLoginStateError();
  }

  try {
    await jwtVerify(state, await getSigningKey(), {
      algorithms: ["HS256"],
      issuer: STATE_ISSUER,
      audience: STATE_AUDIENCE,
    });
  } catch {
    throw new InvalidLoginStateError();
  }
}
