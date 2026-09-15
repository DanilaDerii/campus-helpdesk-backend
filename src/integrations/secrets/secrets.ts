import { getKeyVaultSecret } from "./key-vault.js";

export type SecretName =
  | "DATABASE_URL"
  | "JWT_SECRET"
  | "BREVO_API_KEY"
  | "ENTRA_CLIENT_SECRET";

const cache = new Map<SecretName, string>();

export async function getSecret(name: SecretName): Promise<string> {
  const cached = cache.get(name);
  if (cached) return cached;

  const value = process.env.NODE_ENV === "production"
    ? await getKeyVaultSecret(name)
    : process.env[name]?.trim();

  if (!value) throw new Error(`${name} is required`);

  cache.set(name, value);
  return value;
}
