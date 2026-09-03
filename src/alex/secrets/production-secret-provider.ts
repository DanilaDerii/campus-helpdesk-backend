import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import type { SecretProvider } from "../../providers/secrets/secret-provider.js";

/**
 * Azure Key Vault secret names may contain only letters, digits and dashes, so
 * the application's logical names (which contain underscores) cannot be used as
 * vault names directly. This map is the agreed contract between the backend and
 * the vault; the vault must hold a secret for every name the application asks
 * for at runtime.
 */
const VAULT_SECRET_NAMES: Readonly<Record<string, string>> = {
  DATABASE_URL: "helpdesk-database-url",
  JWT_SECRET: "helpdesk-jwt-secret",
  BREVO_API_KEY: "helpdesk-brevo-api-key",
  PEER_INBOUND_API_KEY: "helpdesk-peer-inbound-api-key",
  EDUCORE_OUTBOUND_API_KEY: "helpdesk-educore-outbound-api-key",
  ENTRA_CLIENT_SECRET: "helpdesk-entra-client-secret",
};

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class AzureKeyVaultSecretProvider implements SecretProvider {
  private readonly client: SecretClient;

  /** In-flight or resolved lookups, keyed by the application's logical name. */
  private readonly cache = new Map<string, Promise<string>>();

  constructor(vaultUrl: string) {
    // DefaultAzureCredential uses the virtual machine's managed identity in
    // production, so no credential is stored on disk or in the environment.
    this.client = new SecretClient(vaultUrl, new DefaultAzureCredential());
  }

  get(name: string): Promise<string> {
    const cached = this.cache.get(name);

    if (cached) {
      return cached;
    }

    const lookup = this.read(name);
    this.cache.set(name, lookup);

    // A failed lookup must not stay cached, otherwise one transient Key Vault
    // error would persist for the lifetime of the process.
    void lookup.catch(() => {
      this.cache.delete(name);
    });

    return lookup;
  }

  private async read(name: string): Promise<string> {
    const vaultSecretName = VAULT_SECRET_NAMES[name];

    if (!vaultSecretName) {
      throw new Error(
        `No Key Vault secret name is mapped for "${name}". Add it to VAULT_SECRET_NAMES.`,
      );
    }

    // Azure errors report status and message only, never the secret value.
    const secret = await this.client
      .getSecret(vaultSecretName)
      .catch((error: unknown) => {
        throw new Error(
          `Could not read "${vaultSecretName}" from Key Vault: ${describe(error)}`,
        );
      });

    if (!secret.value) {
      throw new Error(
        `Key Vault secret "${vaultSecretName}" exists but has no value`,
      );
    }

    return secret.value;
  }
}

/**
 * Production secret provider backed by Azure Key Vault.
 *
 * This factory is called at module load by the configured secret provider, so
 * it must stay synchronous: the Key Vault client is constructed here and every
 * network call happens later inside get().
 */
export function createProductionSecretProvider(): SecretProvider {
  const vaultUrl = process.env.KEY_VAULT_URL?.trim();

  if (!vaultUrl) {
    throw new Error(
      "KEY_VAULT_URL is required when NODE_ENV=production. Set it to the vault URI, for example https://<vault-name>.vault.azure.net",
    );
  }

  return new AzureKeyVaultSecretProvider(vaultUrl);
}
