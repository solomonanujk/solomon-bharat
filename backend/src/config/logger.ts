import pino, { DestinationStream, LoggerOptions } from 'pino';
import { isProduction, isTest } from './env';

/** Credential-bearing fields that must never reach a log line (pino-http logs req/res headers). */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'req.headers["x-api-key"]',
  'req.headers["proxy-authorization"]',
  'res.headers["set-cookie"]',
  'res.headers.authorization',
  'headers.authorization',
  'headers.cookie',
  'headers["x-csrf-token"]',
];

export const REDACT_CENSOR = '[Redacted]';

export const redactOptions: NonNullable<LoggerOptions['redact']> = {
  paths: REDACT_PATHS,
  censor: REDACT_CENSOR,
};

export function createLogger(destination?: DestinationStream): pino.Logger {
  const options: LoggerOptions = {
    level: isTest && !destination ? 'silent' : isProduction ? 'info' : 'debug',
    redact: redactOptions,
    transport:
      destination || isProduction || isTest
        ? undefined
        : {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
  };
  return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger();
