import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env['DYNAMODB_TABLE_NAME'];
if (!TABLE_NAME) {
  throw new Error('DYNAMODB_TABLE_NAME environment variable is required');
}

const client = new DynamoDBClient({
  region: process.env['AWS_REGION'] ?? 'ap-southeast-2',
});

export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE = TABLE_NAME;
