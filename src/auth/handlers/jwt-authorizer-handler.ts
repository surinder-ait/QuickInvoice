/**
 * Lambda Authorizer (TOKEN type) — SECURITY-08.
 * Verifies RS256 JWT, checks tokenVersion for mass revocation support.
 * Returns IAM Allow/Deny policy with userId injected into context.
 */
import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../../shared/db/dynamodb-client';
import { Keys } from '../../shared/db/table-keys';
import { verifyToken } from '../services/token-service';
import { logger } from '../../shared/utils/logger';
import { User } from '../../shared/types/index';

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return deny(event.methodArn);
  }

  try {
    const payload = await verifyToken(token);

    if (payload.type !== 'access') {
      return deny(event.methodArn);
    }

    // Verify tokenVersion against DynamoDB — supports mass revocation (NFR-03.10)
    const { Item } = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: Keys.user.pk(payload.sub), sk: Keys.user.sk() },
        ProjectionExpression: 'userId, tokenVersion',
      }),
    );

    const user = Item as Pick<User, 'userId' | 'tokenVersion'> | undefined;
    if (!user || payload.tokenVersion < user.tokenVersion) {
      logger.warn('Token revoked via tokenVersion', { userId: payload.sub });
      return deny(event.methodArn);
    }

    return allow(event.methodArn, payload.sub, payload.jti);
  } catch (err) {
    logger.warn('JWT authorizer rejection', {
      message: err instanceof Error ? err.message : String(err),
    });
    return deny(event.methodArn);
  }
};

function allow(
  methodArn: string,
  userId: string,
  jti: string,
): APIGatewayAuthorizerResult {
  return {
    principalId: userId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: methodArn,
        },
      ],
    },
    context: { userId, jti },
  };
}

function deny(methodArn: string): APIGatewayAuthorizerResult {
  return {
    principalId: 'denied',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Deny',
          Resource: methodArn,
        },
      ],
    },
  };
}
