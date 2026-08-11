import { env } from '../../config/env';
import { MailProvider } from './mailProvider.types';
import { ResendMailProvider, ConsoleMailProvider } from './resendMailProvider';

export const mailProvider: MailProvider = env.RESEND_API_KEY
  ? new ResendMailProvider(env.RESEND_API_KEY)
  : new ConsoleMailProvider();

export * from './mailProvider.types';
