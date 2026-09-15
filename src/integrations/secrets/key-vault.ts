import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

/** Key Vault names cannot contain underscores, so logical names are mapped. */
const VAULT_SECRET_NAMES: Readonly<Record<string, string>> = {
  DATABASE_URL: "helpdesk-database-url",
  JWT_SECRET: "helpdesk-jwt-secret",
  BREVO_API_KEY: "helpdesk-brevo-api-key",
  ENTRA_CLIENT_SECRET: "helpdesk-entra-client-secret",
};

let client: SecretClient | undefined;

function getClient(): SecretClient {
  if (client) return client;

  const vaultUrl = process.env.KEY_VAULT_URL?.trim();
  if (!vaultUrl) {
    throw new Error("KEY_VAULT_URL is required in production");
  }

  client = new SecretClient(vaultUrl, new DefaultAzureCredential());
  return client;
}

export async function getKeyVaultSecret(name: string): Promise<string> {
  const vaultName = VAULT_SECRET_NAMES[name];
  if (!vaultName) throw new Error(`No Key Vault mapping exists for ${name}`);

  const secret = await getClient().getSecret(vaultName);
  if (!secret.value) throw new Error(`${vaultName} has no value in Key Vault`);

  return secret.value;
}
