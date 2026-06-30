import { v4 as uuidv4 } from 'uuid';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../../shared/db/dynamodb-client';
import { Keys } from '../../shared/db/table-keys';
import { Client, CreateClientRequest, UpdateClientRequest } from '../../shared/types/index';
import { NotFoundError, ForbiddenError } from '../../shared/utils/error-handler';
import { logger } from '../../shared/utils/logger';

export async function createClient(
  userId: string,
  req: CreateClientRequest,
): Promise<Client> {
  const clientId = uuidv4();
  const now = new Date().toISOString();

  const client: Client & Record<string, unknown> = {
    pk: Keys.client.pk(userId),
    sk: Keys.client.sk(clientId),
    clientId,
    userId,
    name: req.name,
    email: req.email.toLowerCase(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: client }));
  logger.info('Client created', { userId, clientId });
  return toClient(client);
}

export async function listClients(userId: string): Promise<Client[]> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      FilterExpression: 'attribute_not_exists(deletedAt) OR deletedAt = :null',
      ExpressionAttributeValues: {
        ':pk': Keys.client.pk(userId),
        ':prefix': 'CLIENT#',
        ':null': null,
      },
    }),
  );
  return (Items ?? []).map(toClient);
}

export async function getClient(userId: string, clientId: string): Promise<Client> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { pk: Keys.client.pk(userId), sk: Keys.client.sk(clientId) },
    }),
  );
  if (!Item || Item['deletedAt']) throw new NotFoundError('Client');
  assertOwnership(Item as Client, userId);
  return toClient(Item as Client);
}

export async function updateClient(
  userId: string,
  clientId: string,
  req: UpdateClientRequest,
): Promise<Client> {
  await getClient(userId, clientId); // ownership + existence check

  const updateParts: string[] = ['updatedAt = :ts'];
  const values: Record<string, unknown> = { ':ts': new Date().toISOString() };

  if (req.name !== undefined) {
    updateParts.push('#name = :name');
    values[':name'] = req.name;
  }
  if (req.email !== undefined) {
    updateParts.push('email = :email');
    values[':email'] = req.email.toLowerCase();
  }

  const { Attributes } = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: Keys.client.pk(userId), sk: Keys.client.sk(clientId) },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeNames: req.name !== undefined ? { '#name': 'name' } : undefined,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }),
  );
  logger.info('Client updated', { userId, clientId });
  return toClient(Attributes as Client);
}

export async function deleteClient(userId: string, clientId: string): Promise<void> {
  await getClient(userId, clientId); // ownership + existence check

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: Keys.client.pk(userId), sk: Keys.client.sk(clientId) },
      UpdateExpression: 'SET deletedAt = :ts, updatedAt = :ts',
      ExpressionAttributeValues: { ':ts': new Date().toISOString() },
    }),
  );
  logger.info('Client soft-deleted', { userId, clientId });
}

function assertOwnership(item: { userId: string }, userId: string): void {
  if (item.userId !== userId) throw new ForbiddenError();
}

function toClient(item: Record<string, unknown>): Client {
  return {
    clientId: item['clientId'] as string,
    userId: item['userId'] as string,
    name: item['name'] as string,
    email: item['email'] as string,
    createdAt: item['createdAt'] as string,
    updatedAt: item['updatedAt'] as string,
    deletedAt: (item['deletedAt'] as string | null) ?? null,
  };
}
