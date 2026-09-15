import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import type { SecretProvider } from "./secret-provider.js";

/** Key Vault names cannot contain underscores, so logical names are mapped. */
const VAULT_SECRET_NAMES: Readonly<Record<string, string>> = {
  DATABASE_URL: "helpdesk-database-url",
  JWT_SECRET: "helpdesk-jwt-secret",
  BREVO_API_KEY: "helpdesk-brevo-api-key",
  ENTRA_CLIENT_SECRET: "helpdesk-entra-client-secret",
};

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class AzureKeyVaultSecretProvider implements SecretProvider {
  private readonly client: SecretClient;
  private readonly cache = new Map<string, Promise<string>>();

  constructor(vaultUrl: string) {
    // Uses the VM's managed identity; no credential is stored on the host.
    this.client = new SecretClient(vaultUrl, new DefaultAzureCredential());
  }

  get(name: string): Promise<string> {
    const cached = this.cache.get(name);

    if (cached) {
      return cached;
    }

    const lookup = this.read(name);
    this.cache.set(name, lookup);

    // Do not cache a failed lookup.
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

export function createKeyVaultSecretProvider(): SecretProvider {
  const vaultUrl = process.env.KEY_VAULT_URL?.trim();

  if (!vaultUrl) {
    throw new Error(
      "KEY_VAULT_URL is required when NODE_ENV=production. Set it to the vault URI, for example https://<vault-name>.vault.azure.net",
    );
  }

  return new AzureKeyVaultSecretProvider(vaultUrl);
}
