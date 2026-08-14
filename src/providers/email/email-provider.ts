export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailResult {
  providerMessageId?: string;
}

/** Console and Brevo implementations will follow this contract. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}
