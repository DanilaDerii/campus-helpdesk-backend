export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailResult {
  providerMessageId?: string;
}

/** Console and Brevo implementations share this contract. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}
