import { randomUUID } from "node:crypto";
import { logEvent } from "../../logging/logger.js";
import type {
  EmailMessage,
  EmailProvider,
  EmailResult,
} from "./email-provider.js";

/** Development provider that exercises delivery without contacting a real API. */
export class ConsoleEmailProvider implements EmailProvider {
  async send(_message: EmailMessage): Promise<EmailResult> {
    const providerMessageId = `console-${randomUUID()}`;

    logEvent("debug", "development_email_accepted", { operation: "email_delivery" });

    return { providerMessageId };
  }
}
