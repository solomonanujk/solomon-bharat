import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { logger } from './config/logger';
import { swaggerSpec } from './config/swagger';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { csrfProtection } from './middleware/csrf';
import { publicRateLimiter } from './middleware/rateLimiter';
import { UPLOADS_ROOT } from './providers/storage';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.APP_URL,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));
  app.use('/uploads', express.static(UPLOADS_ROOT));

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/api/v1', publicRateLimiter, csrfProtection, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
