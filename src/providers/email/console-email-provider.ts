import type {
  EmailMessage,
  EmailProvider,
  EmailResult,
} from "./email-provider.js";

/** Local stub: accept the call without sending an email. */
export class ConsoleEmailProvider implements EmailProvider {
  async send(_message: EmailMessage): Promise<EmailResult> {
    return {};
  }
}
