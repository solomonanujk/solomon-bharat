import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req[target]);
    req[target] = parsed;
    next();
  };
}
