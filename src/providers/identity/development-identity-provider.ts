import type {
  ExternalIdentity,
  IdentityProvider,
} from "./identity-provider.js";

function readEmail(input: unknown): string {
  if (
    typeof input !== "object" ||
    input === null ||
    !("email" in input) ||
    typeof input.email !== "string" ||
    input.email.trim() === ""
  ) {
    throw new Error("Development identity requires a non-empty email");
  }

  return input.email.trim().toLowerCase();
}

/** Trusts a supplied email only for the non-production development login. */
export class DevelopmentIdentityProvider implements IdentityProvider {
  async completeLogin(input: unknown): Promise<ExternalIdentity> {
    const email = readEmail(input);

    return {
      microsoftOid: `development:${email}`,
      email,
      displayName: email,
    };
  }
}
