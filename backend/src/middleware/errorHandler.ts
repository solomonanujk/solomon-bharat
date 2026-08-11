import { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    data: null,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      data: null,
      message: err.message,
      ...(err.details ? { meta: { details: err.details } } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      data: null,
      message: 'Validation error',
      meta: { details: err.flatten() },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        data: null,
        message: 'A record with this value already exists',
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        data: null,
        message: 'Record not found',
      });
      return;
    }
  }

  logger.error({ err, path: req.originalUrl }, 'Unhandled error');
  res.status(500).json({
    success: false,
    data: null,
    message: 'Internal server error',
  });
};
