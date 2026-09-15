import { ConfidentialClientApplication } from "@azure/msal-node";
import type {
  ExternalIdentity,
  IdentityProvider,
} from "./identity-provider.js";
import { configuredSecretProvider } from "../secrets/configured-secret-provider.js";

/**
 * Microsoft Entra ID sign-in (authorization code flow with PKCE, via MSAL).
 * Microsoft proves identity only; roles come from the local database.
 */

export interface EntraConfiguration {
  tenantId: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface EntraCallback {
  code: string;
  codeVerifier: string;
}

export class EntraNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      `Microsoft login is not configured in this environment. Missing: ${missing.join(", ")}`,
    );
    this.name = "EntraNotConfiguredError";
  }
}

interface EntraIdTokenClaims {
  oid?: string;
  sub?: string;
  tid?: string;
  preferred_username?: string;
  email?: string;
  upn?: string;
  name?: string;
}

function readEnvironment(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === "" ? undefined : value;
}

/** Non-secret Entra settings. The client secret is read on first use. */
export function readEntraConfiguration(): EntraConfiguration {
  const tenantId = readEnvironment("ENTRA_TENANT_ID");
  const clientId = readEnvironment("ENTRA_CLIENT_ID");
  const redirectUri = readEnvironment("ENTRA_REDIRECT_URI");

  const missing: string[] = [];
  if (!tenantId) missing.push("ENTRA_TENANT_ID");
  if (!clientId) missing.push("ENTRA_CLIENT_ID");
  if (!redirectUri) missing.push("ENTRA_REDIRECT_URI");

  if (!tenantId || !clientId || !redirectUri) {
    throw new EntraNotConfiguredError(missing);
  }

  const scopes = (readEnvironment("ENTRA_SCOPES") ?? "openid profile email")
    .split(/\s+/)
    .filter((scope) => scope !== "");

  return { tenantId, clientId, redirectUri, scopes };
}

export class EntraIdentityProvider implements IdentityProvider {
  private client?: Promise<ConfidentialClientApplication>;

  constructor(private readonly configuration: EntraConfiguration) {}

  private getClient(): Promise<ConfidentialClientApplication> {
    if (!this.client) {
      const lookup = configuredSecretProvider
        .get("ENTRA_CLIENT_SECRET")
        .then(
          (clientSecret) =>
            new ConfidentialClientApplication({
              auth: {
                clientId: this.configuration.clientId,
                authority: `https://login.microsoftonline.com/${this.configuration.tenantId}`,
                clientSecret,
              },
            }),
        );

      this.client = lookup;

      void lookup.catch(() => {
        if (this.client === lookup) {
          this.client = undefined;
        }
      });
    }

    return this.client;
  }

  async getAuthorizationUrl(
    state: string,
    codeChallenge: string,
  ): Promise<string> {
    const client = await this.getClient();

    return client.getAuthCodeUrl({
      scopes: this.configuration.scopes,
      redirectUri: this.configuration.redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod: "S256",
    });
  }

  /** Exchanges the code for tokens; MSAL validates the returned ID token. */
  async completeLogin(input: unknown): Promise<ExternalIdentity> {
    if (
      typeof input !== "object" ||
      input === null ||
      !("code" in input) ||
      typeof input.code !== "string" ||
      !("codeVerifier" in input) ||
      typeof input.codeVerifier !== "string" ||
      input.codeVerifier === ""
    ) {
      throw new Error(
        "Microsoft login requires an authorization code and PKCE verifier",
      );
    }

    const client = await this.getClient();
    const result = await client.acquireTokenByCode({
      code: (input as EntraCallback).code,
      scopes: this.configuration.scopes,
      redirectUri: this.configuration.redirectUri,
      codeVerifier: (input as EntraCallback).codeVerifier,
    });

    const claims = (result.idTokenClaims ?? {}) as EntraIdTokenClaims;

    if (claims.tid !== this.configuration.tenantId) {
      throw new Error("This account belongs to a different directory");
    }

    const microsoftOid = claims.oid ?? claims.sub;
    const email = claims.preferred_username ?? claims.email ?? claims.upn;

    if (!microsoftOid || !email) {
      throw new Error("The Microsoft token is missing required identity claims");
    }

    return {
      microsoftOid,
      email: email.trim().toLowerCase(),
      displayName: claims.name?.trim() || email,
    };
  }
}

let cachedProvider: EntraIdentityProvider | undefined;

/** Built lazily so development, which has no Entra settings, still starts. */
export function getEntraIdentityProvider(): EntraIdentityProvider {
  cachedProvider ??= new EntraIdentityProvider(readEntraConfiguration());
  return cachedProvider;
}
