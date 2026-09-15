import type { EmailMessage } from "./email.js";
import { getSecret } from "../secrets/secrets.js";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const REQUEST_TIMEOUT_MS = 10_000;

export async function sendBrevoEmail(message: EmailMessage): Promise<void> {
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const name = process.env.BREVO_SENDER_NAME?.trim() || "Campus HelpDesk";

  if (!senderEmail) {
    throw new Error("BREVO_SENDER_EMAIL is required in production");
  }

  const response = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": await getSecret("BREVO_API_KEY"),
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name },
      to: [{ email: message.to }],
      subject: message.subject,
      textContent: message.text,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Brevo rejected the email request with status ${response.status}`,
    );
  }
}
