import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../../shared/db/dynamodb-client';
import { Keys } from '../../shared/db/table-keys';
import { Invoice, DashboardSummary } from '../../shared/types/index';
import { computeDashboard } from './dashboard-calculator';

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      FilterExpression: 'attribute_not_exists(deletedAt) OR deletedAt = :null',
      ExpressionAttributeValues: {
        ':pk': Keys.invoice.pk(userId),
        ':prefix': 'INVOICE#',
        ':null': null,
      },
    }),
  );

  const invoices = (Items ?? []) as Invoice[];
  return computeDashboard(invoices, new Date());
}
