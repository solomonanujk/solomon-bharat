import { Response } from 'express';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponseBody<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: PaginationMeta | Record<string, unknown>;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: PaginationMeta | Record<string, unknown>,
): Response {
  const body: ApiResponseBody<T> = { success: true, data, message };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T, message = 'Created'): Response {
  return sendSuccess(res, data, message, 201);
}
