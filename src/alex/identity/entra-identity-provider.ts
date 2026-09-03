import { ConfidentialClientApplication } from "@azure/msal-node";
import type {
  ExternalIdentity,
  IdentityProvider,
} from "../../providers/identity/identity-provider.js";
import { configuredSecretProvider } from "../../providers/secrets/configured-secret-provider.js";

/**
 * Microsoft Entra ID identity provider.
 *
 * Runs the OpenID Connect authorization-code flow with MSAL. Microsoft proves
 * who the person is; the local database still decides what they may do, so no
 * role or group claim from Microsoft is trusted here.
 */

export interface EntraConfiguration {
  tenantId: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface EntraCallback {
  code: string;
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

/**
 * Reads Entra settings from non-secret configuration. The client secret is not
 * read here: it comes from the secret provider when the client is first built.
 *
 * Default scopes are the standard OpenID Connect sign-in scopes. If a tenant
 * rejects them, set ENTRA_SCOPES to a delegated scope such as "User.Read".
 */
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

  /**
   * Built on first use rather than in a constructor, because the client secret
   * has to be awaited from Key Vault.
   */
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

  /** The Microsoft sign-in URL to redirect the browser to. */
  async getAuthorizationUrl(state: string): Promise<string> {
    const client = await this.getClient();

    return client.getAuthCodeUrl({
      scopes: this.configuration.scopes,
      redirectUri: this.configuration.redirectUri,
      state,
    });
  }

  /**
   * Exchange the authorization code for tokens and normalize the result.
   * MSAL validates the returned token, including its signature, issuer,
   * audience and expiry.
   */
  async completeLogin(input: unknown): Promise<ExternalIdentity> {
    if (
      typeof input !== "object" ||
      input === null ||
      !("code" in input) ||
      typeof (input as { code: unknown }).code !== "string"
    ) {
      throw new Error("Microsoft login requires an authorization code");
    }

    const client = await this.getClient();
    const result = await client.acquireTokenByCode({
      code: (input as EntraCallback).code,
      scopes: this.configuration.scopes,
      redirectUri: this.configuration.redirectUri,
    });

    const claims = (result.idTokenClaims ?? {}) as EntraIdTokenClaims;

    // Defence in depth: the application is registered single-tenant, so
    // Microsoft already refuses other directories, but do not rely on that
    // registration staying single-tenant.
    if (claims.tid && claims.tid !== this.configuration.tenantId) {
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

/**
 * Built lazily on first request. The routes are always mounted, including in
 * development where no Entra settings exist, so construction must not happen
 * at module load.
 */
export function getEntraIdentityProvider(): EntraIdentityProvider {
  cachedProvider ??= new EntraIdentityProvider(readEntraConfiguration());
  return cachedProvider;
}
