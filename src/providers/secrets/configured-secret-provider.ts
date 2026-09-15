import { EnvSecretProvider } from "./env-secret-provider.js";
import { createKeyVaultSecretProvider } from "./key-vault-secret-provider.js";
import type { SecretProvider } from "./secret-provider.js";

function createSecretProvider(): SecretProvider {
  if (process.env.NODE_ENV === "production") {
    return createKeyVaultSecretProvider();
  }

  return new EnvSecretProvider();
}

/** The application-wide provider selected by the runtime environment. */
export const configuredSecretProvider = createSecretProvider();
