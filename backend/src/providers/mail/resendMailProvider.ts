import { Resend } from 'resend';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { MailProvider, SendMailInput } from './mailProvider.types';

export class ResendMailProvider implements MailProvider {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async sendMail(input: SendMailInput): Promise<void> {
    const { error } = await this.client.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    if (error) {
      logger.error({ error, to: input.to }, 'Resend email send failed');
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}

/**
 * Dev fallback so the app runs end-to-end without a Resend API key.
 * Logs the email instead of sending it — swap for ResendMailProvider once
 * RESEND_API_KEY is configured (see mailProvider.ts factory).
 */
export class ConsoleMailProvider implements MailProvider {
  async sendMail(input: SendMailInput): Promise<void> {
    logger.info(
      { to: input.to, subject: input.subject },
      '[ConsoleMailProvider] Email not sent — RESEND_API_KEY not configured. Logging instead:',
    );
    logger.debug({ html: input.html }, '[ConsoleMailProvider] email body');
  }
}
