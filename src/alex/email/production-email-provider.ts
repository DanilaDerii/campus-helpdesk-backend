import type { EmailProvider } from "../../providers/email/email-provider.js";

/** Alex replaces this boundary with the production Brevo provider. */
export function createProductionEmailProvider(): EmailProvider {
  throw new Error(
    "Brevo email provider must be implemented in src/alex/email",
  );
}
