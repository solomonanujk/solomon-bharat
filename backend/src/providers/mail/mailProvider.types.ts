export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

export interface MailProvider {
  sendMail(input: SendMailInput): Promise<void>;
}
