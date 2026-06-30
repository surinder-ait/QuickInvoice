/**
 * Brute-force login protection — SECURITY-12.
 * Tracks failed login attempts per email in DynamoDB with TTL.
 * Locks account after MAX_ATTEMPTS failures within WINDOW_SECONDS.
 */
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../../shared/db/dynamodb-client';
import { Keys } from '../../shared/db/table-keys';
import { UnauthorizedError } from '../../shared/utils/error-handler';

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

interface AttemptRecord {
  pk: string;
  sk: string;
  count: number;
  ttl: number; // Unix epoch seconds
}

export async function recordFailedAttempt(email: string): Promise<void> {
  const pk = Keys.loginAttempt.pk(email);
  const sk = Keys.loginAttempt.sk();
  const ttl = Math.floor(Date.now() / 1000) + WINDOW_SECONDS;

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk, sk },
      UpdateExpression: 'ADD #count :inc SET #ttl = :ttl',
      ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':inc': 1, ':ttl': ttl },
    }),
  );
}

export async function checkBruteForce(email: string): Promise<void> {
  const pk = Keys.loginAttempt.pk(email);
  const sk = Keys.loginAttempt.sk();

  const { Item } = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { pk, sk } }),
  );

  const record = Item as AttemptRecord | undefined;
  if (record && record.count >= MAX_ATTEMPTS) {
    throw new UnauthorizedError(
      'Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.',
    );
  }
}

export async function clearAttempts(email: string): Promise<void> {
  const pk = Keys.loginAttempt.pk(email);
  const sk = Keys.loginAttempt.sk();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { pk, sk, count: 0, ttl: Math.floor(Date.now() / 1000) + 60 },
    }),
  );
}
