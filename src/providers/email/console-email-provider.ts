import { randomUUID } from "node:crypto";
import type {
  EmailMessage,
  EmailProvider,
  EmailResult,
} from "./email-provider.js";

/** Development provider that exercises delivery without contacting a real API. */
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<EmailResult> {
    const providerMessageId = `console-${randomUUID()}`;

    // Do not print the message body because ticket text may be sensitive.
    console.log(
      `[email:console] id=${providerMessageId} to=${message.to} subject=${message.subject}`,
    );

    return { providerMessageId };
  }
}
