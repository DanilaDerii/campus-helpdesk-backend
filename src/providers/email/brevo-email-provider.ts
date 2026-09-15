import type {
  EmailMessage,
  EmailProvider,
  EmailResult,
} from "./email-provider.js";
import { configuredSecretProvider } from "../secrets/configured-secret-provider.js";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const BREVO_API_KEY_SECRET = "BREVO_API_KEY";
const REQUEST_TIMEOUT_MS = 10_000;

interface BrevoSender {
  email: string;
  name: string;
}

interface BrevoResponse {
  messageId?: string;
}

/**
 * Sends email through the Brevo transactional API. Failures are thrown; the
 * caller logs them. The API key and message body are never logged.
 */
class BrevoEmailProvider implements EmailProvider {
  private apiKeyLookup?: Promise<string>;

  constructor(private readonly sender: BrevoSender) {}

  private getApiKey(): Promise<string> {
    if (!this.apiKeyLookup) {
      const lookup = configuredSecretProvider.get(BREVO_API_KEY_SECRET);
      this.apiKeyLookup = lookup;

      // Do not cache a failed lookup.
      void lookup.catch(() => {
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
        await response.body?.cancel();
        throw Object.assign(new Error("Brevo rejected the email request"), {
          statusCode: response.status,
        });
      }

      const payload = (await response.json().catch(() => ({}))) as BrevoResponse;
      return { providerMessageId: payload.messageId };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Validates sender settings; the API key is read from secrets on first send. */
export function createBrevoEmailProvider(): EmailProvider {
  const email = process.env.BREVO_SENDER_EMAIL?.trim();
  const name = process.env.BREVO_SENDER_NAME?.trim() || "Campus HelpDesk";

  if (!email) {
    throw new Error(
      "BREVO_SENDER_EMAIL is required when NODE_ENV=production. Use an address verified as a sender in Brevo.",
    );
  }

  return new BrevoEmailProvider({ email, name });
}
