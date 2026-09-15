import { createHash, randomBytes, randomUUID } from "node:crypto";

export interface ExternalIdentity {
  microsoftOid: string;
  email: string;
  displayName: string;
}

export interface LoginTransaction {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

export class InvalidLoginStateError extends Error {
  constructor() {
    super("The login state is missing, invalid, or expired");
    this.name = "InvalidLoginStateError";
  }
}

export function createDevelopmentIdentity(email: string): ExternalIdentity {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Development identity requires an email");

  return {
    microsoftOid: `development:${normalizedEmail}`,
    email: normalizedEmail,
    displayName: normalizedEmail,
  };
}

export function createLoginTransaction(): LoginTransaction {
  const codeVerifier = randomBytes(32).toString("base64url");

  return {
    state: randomUUID(),
    codeVerifier,
    codeChallenge: createHash("sha256")
      .update(codeVerifier)
      .digest("base64url"),
  };
}

export function verifyLoginState(state: unknown, browserState: unknown): void {
  if (
    typeof state !== "string" ||
    state === "" ||
    typeof browserState !== "string" ||
    state !== browserState
  ) {
    throw new InvalidLoginStateError();
  }
}
