import { createProductionSecretProvider } from "../../alex/secrets/index.js";
import { EnvSecretProvider } from "./env-secret-provider.js";
import type { SecretProvider } from "./secret-provider.js";

function createSecretProvider(): SecretProvider {
  if (process.env.NODE_ENV === "production") {
    return createProductionSecretProvider();
  }

  return new EnvSecretProvider();
}

/** The application-wide provider selected by the runtime environment. */
export const configuredSecretProvider = createSecretProvider();
