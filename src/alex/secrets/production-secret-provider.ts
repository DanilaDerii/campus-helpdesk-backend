import type { SecretProvider } from "../../providers/secrets/secret-provider.js";

/** Alex replaces this boundary with the production Azure Key Vault provider. */
export function createProductionSecretProvider(): SecretProvider {
  throw new Error(
    "Azure Key Vault provider must be implemented in src/alex/secrets",
  );
}
