export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(403, message);
  }

  static notFound(message = 'Not found') {
    return new AppError(404, message);
  }

  static conflict(message: string, details?: unknown) {
    return new AppError(409, message, details);
  }

  static unprocessable(message: string, details?: unknown) {
    return new AppError(422, message, details);
  }

  static internal(message = 'Internal server error') {
    return new AppError(500, message);
  }
}
