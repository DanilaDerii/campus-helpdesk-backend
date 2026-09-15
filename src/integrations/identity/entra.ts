import { ConfidentialClientApplication } from "@azure/msal-node";
import type { ExternalIdentity } from "./support.js";
import { getSecret } from "../secrets/secrets.js";

/**
 * Microsoft Entra ID sign-in (authorization code flow with PKCE, via MSAL).
 * Microsoft proves identity only; roles come from the local database.
 */

interface EntraConfiguration {
  tenantId: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

interface EntraCallback {
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

function readEntraConfiguration(): EntraConfiguration {
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

interface EntraClient {
  configuration: EntraConfiguration;
  client: ConfidentialClientApplication;
}

let cachedClient: EntraClient | undefined;

async function getEntraClient(): Promise<EntraClient> {
  if (cachedClient) return cachedClient;

  const configuration = readEntraConfiguration();
  const clientSecret = await getSecret("ENTRA_CLIENT_SECRET");
  const client = new ConfidentialClientApplication({
    auth: {
      clientId: configuration.clientId,
      authority: `https://login.microsoftonline.com/${configuration.tenantId}`,
      clientSecret,
    },
  });

  cachedClient = { configuration, client };
  return cachedClient;
}

export async function createMicrosoftLoginUrl(
  state: string,
  codeChallenge: string,
): Promise<string> {
  const { client, configuration } = await getEntraClient();

  return client.getAuthCodeUrl({
    scopes: configuration.scopes,
    redirectUri: configuration.redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod: "S256",
  });
}

/** Exchange the callback code and return the verified Microsoft identity. */
export async function completeMicrosoftLogin(
  input: EntraCallback,
): Promise<ExternalIdentity> {
  const { client, configuration } = await getEntraClient();
  const result = await client.acquireTokenByCode({
    code: input.code,
    scopes: configuration.scopes,
    redirectUri: configuration.redirectUri,
    codeVerifier: input.codeVerifier,
  });

  const claims = (result.idTokenClaims ?? {}) as EntraIdTokenClaims;

  if (claims.tid !== configuration.tenantId) {
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
