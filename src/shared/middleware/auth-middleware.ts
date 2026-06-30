import { APIGatewayProxyEvent } from 'aws-lambda';
import { ForbiddenError } from '../utils/error-handler';

/**
 * Extract userId from the JWT authorizer context.
 * SECURITY-08: userId is ALWAYS sourced from the verified JWT context —
 * never from request body, path params, or query strings.
 */
export function getUserId(event: APIGatewayProxyEvent): string {
  const userId = event.requestContext?.authorizer?.['userId'] as string | undefined;
  if (!userId) {
    throw new ForbiddenError();
  }
  return userId;
}
