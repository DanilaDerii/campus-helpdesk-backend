import type {
  EmailMessage,
  EmailProvider,
  EmailResult,
} from "../../providers/email/email-provider.js";
import { configuredSecretProvider } from "../../providers/secrets/configured-secret-provider.js";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const BREVO_API_KEY_SECRET = "BREVO_API_KEY";
const REQUEST_TIMEOUT_MS = 10_000;
const MAXIMUM_ERROR_DETAIL = 300;

interface BrevoSender {
  email: string;
  name: string;
}

interface BrevoResponse {
  messageId?: string;
}

/**
 * Production email provider backed by the Brevo transactional email API.
 *
 * Failures are thrown rather than absorbed: the notification service records
 * the attempt as FAILED and its retry worker tries again later. Nothing here
 * logs the API key, the authorization header, or the message body.
 */
class BrevoEmailProvider implements EmailProvider {
  /** Cached in-flight or resolved API key lookup. */
  private apiKeyLookup?: Promise<string>;

  constructor(private readonly sender: BrevoSender) {}

  private getApiKey(): Promise<string> {
    if (!this.apiKeyLookup) {
      // Read on first use, because the factory below must stay synchronous.
      const lookup = configuredSecretProvider.get(BREVO_API_KEY_SECRET);
      this.apiKeyLookup = lookup;

      void lookup.catch(() => {
        // Never cache a failed lookup, or one transient secret-store error
        // would disable email for the lifetime of the process.
        if (this.apiKeyLookup === lookup) {
          this.apiKeyLookup = undefined;
        }
      });
    }

    return this.apiKeyLookup;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const apiKey = await this.getApiKey();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(BREVO_ENDPOINT, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: this.sender,
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Brevo error bodies describe the rejection (for example an
        // unverified sender) and never echo the API key. Truncated so a large
        // response cannot flood the notification error column or the log.
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Brevo responded ${response.status}${
            detail ? `: ${detail.slice(0, MAXIMUM_ERROR_DETAIL)}` : ""
          }`,
        );
      }

      const payload = (await response.json().catch(() => ({}))) as BrevoResponse;
      return { providerMessageId: payload.messageId };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Builds the Brevo provider. Called at module load by the notification
 * service, so it must stay synchronous: only non-secret sender settings are
 * validated here, and the API key is fetched from the secret provider on the
 * first send.
 */
export function createProductionEmailProvider(): EmailProvider {
  const email = process.env.BREVO_SENDER_EMAIL?.trim();
  const name = process.env.BREVO_SENDER_NAME?.trim() || "Campus HelpDesk";

  if (!email) {
    throw new Error(
      "BREVO_SENDER_EMAIL is required when NODE_ENV=production. Use an address verified as a sender in Brevo.",
    );
  }

  return new BrevoEmailProvider({ email, name });
}
