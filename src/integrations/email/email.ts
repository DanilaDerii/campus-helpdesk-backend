import { sendBrevoEmail } from "./brevo.js";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Send through Brevo in production. Local development intentionally does nothing. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    await sendBrevoEmail(message);
  }
}
