/**
 * Global Lambda error handler — SECURITY-09, SECURITY-15.
 * Returns generic user-facing messages; full details go to CloudWatch only.
 */
import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';
import { ValidationError } from './validation';
import { buildResponse } from './response';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly expose = true,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`);
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super(403, 'Access denied');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

/**
 * Wrap a Lambda handler body. Catches all errors and returns safe responses.
 * Never leaks stack traces or internal detail to the caller.
 */
export function handleError(err: unknown): APIGatewayProxyResult {
  if (err instanceof ValidationError) {
    return buildResponse(400, { error: err.message });
  }
  if (err instanceof AppError) {
    logger.warn('AppError', { statusCode: err.statusCode, message: err.message });
    return buildResponse(err.statusCode, { error: err.message });
  }
  // Unknown / unexpected error — log full detail, return generic message
  logger.error('Unhandled error', {
    name: err instanceof Error ? err.name : 'Unknown',
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return buildResponse(500, { error: 'An internal error occurred' });
}
