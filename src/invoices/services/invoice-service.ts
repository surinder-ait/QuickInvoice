import { v4 as uuidv4 } from 'uuid';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../../shared/db/dynamodb-client';
import { Keys } from '../../shared/db/table-keys';
import {
  Invoice,
  InvoiceStatus,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
} from '../../shared/types/index';
import {
  NotFoundError,
  ForbiddenError,
  AppError,
} from '../../shared/utils/error-handler';
import { logger } from '../../shared/utils/logger';
import {
  calculateTotals,
  formatInvoiceNumber,
  validateStatusTransition,
} from './invoice-calculator';

export async function createInvoice(
  userId: string,
  req: CreateInvoiceRequest,
): Promise<Invoice> {
  // Atomic counter increment via conditional write
  const counter = await incrementInvoiceCounter(userId);

  // Get user's invoice prefix
  const { Item: userItem } = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { pk: `USER#${userId}`, sk: 'PROFILE' },
      ProjectionExpression: 'invoicePrefix',
    }),
  );
  const prefix = (userItem?.['invoicePrefix'] as string | undefined) ?? 'INV';

  const invoiceId = uuidv4();
  const now = new Date().toISOString();
  const totals = calculateTotals(req.lineItems);

  const invoice: Invoice & Record<string, unknown> = {
    pk: Keys.invoice.pk(userId),
    sk: Keys.invoice.sk(invoiceId),
    gsi1pk: Keys.invoice.gsi1pk(userId),
    gsi1sk: Keys.invoice.gsi1sk('draft', now),
    invoiceId,
    userId,
    clientId: req.clientId,
    invoiceNumber: formatInvoiceNumber(prefix, counter),
    status: 'draft' as InvoiceStatus,
    issueDate: req.issueDate,
    dueDate: req.dueDate,
    currency: 'AUD',
    lineItems: req.lineItems,
    ...totals,
    notes: req.notes ?? null,
    createdAt: now,
    updatedAt: now,
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    deletedAt: null,
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: invoice }));
  logger.info('Invoice created', { userId, invoiceId, invoiceNumber: invoice['invoiceNumber'] });
  return toInvoice(invoice);
}

export async function listInvoices(
  userId: string,
  statusFilter?: InvoiceStatus,
): Promise<Invoice[]> {
  const queryParams = statusFilter
    ? {
        TableName: TABLE,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk AND begins_with(gsi1sk, :prefix)',
        FilterExpression: 'attribute_not_exists(deletedAt) OR deletedAt = :null',
        ExpressionAttributeValues: {
          ':pk': Keys.invoice.gsi1pk(userId),
          ':prefix': `STATUS#${statusFilter}#`,
          ':null': null,
        },
      }
    : {
        TableName: TABLE,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        FilterExpression: 'attribute_not_exists(deletedAt) OR deletedAt = :null',
        ExpressionAttributeValues: {
          ':pk': Keys.invoice.pk(userId),
          ':prefix': 'INVOICE#',
          ':null': null,
        },
      };

  const { Items } = await ddb.send(new QueryCommand(queryParams));
  return (Items ?? []).map(toInvoice).sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );
}

export async function getInvoice(userId: string, invoiceId: string): Promise<Invoice> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { pk: Keys.invoice.pk(userId), sk: Keys.invoice.sk(invoiceId) },
    }),
  );
  if (!Item || Item['deletedAt']) throw new NotFoundError('Invoice');
  if (Item['userId'] !== userId) throw new ForbiddenError();
  return toInvoice(Item as Invoice);
}

export async function updateInvoice(
  userId: string,
  invoiceId: string,
  req: UpdateInvoiceRequest,
): Promise<Invoice> {
  const existing = await getInvoice(userId, invoiceId);
  if (existing.status !== 'draft') {
    throw new AppError(409, 'Only draft invoices can be edited');
  }

  const lineItems = req.lineItems ?? existing.lineItems;
  const totals = calculateTotals(lineItems);
  const now = new Date().toISOString();

  const { Attributes } = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: Keys.invoice.pk(userId), sk: Keys.invoice.sk(invoiceId) },
      UpdateExpression: `SET
        clientId = :cid,
        issueDate = :id,
        dueDate = :dd,
        lineItems = :li,
        notes = :notes,
        subtotal = :sub,
        taxTotal = :tax,
        grandTotal = :grand,
        updatedAt = :ts`,
      ExpressionAttributeValues: {
        ':cid': req.clientId ?? existing.clientId,
        ':id': req.issueDate ?? existing.issueDate,
        ':dd': req.dueDate ?? existing.dueDate,
        ':li': lineItems,
        ':notes': req.notes !== undefined ? req.notes : existing.notes,
        ':sub': totals.subtotal,
        ':tax': totals.taxTotal,
        ':grand': totals.grandTotal,
        ':ts': now,
      },
      ReturnValues: 'ALL_NEW',
    }),
  );
  logger.info('Invoice updated', { userId, invoiceId });
  return toInvoice(Attributes as Invoice);
}

export async function deleteInvoice(userId: string, invoiceId: string): Promise<void> {
  const existing = await getInvoice(userId, invoiceId);
  if (existing.status !== 'draft') {
    throw new AppError(409, 'Only draft invoices can be deleted');
  }
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: Keys.invoice.pk(userId), sk: Keys.invoice.sk(invoiceId) },
      UpdateExpression: 'SET deletedAt = :ts, updatedAt = :ts',
      ExpressionAttributeValues: { ':ts': new Date().toISOString() },
    }),
  );
  logger.info('Invoice deleted', { userId, invoiceId });
}

export async function duplicateInvoice(userId: string, invoiceId: string): Promise<Invoice> {
  const source = await getInvoice(userId, invoiceId);
  return createInvoice(userId, {
    clientId: source.clientId,
    issueDate: new Date().toISOString().split('T')[0]!,
    dueDate: source.dueDate,
    lineItems: source.lineItems,
    notes: source.notes ?? undefined,
  });
}

export async function transitionStatus(
  userId: string,
  invoiceId: string,
  newStatus: InvoiceStatus,
): Promise<Invoice> {
  const existing = await getInvoice(userId, invoiceId);
  validateStatusTransition(existing.status, newStatus);

  const now = new Date().toISOString();
  const timestampField =
    newStatus === 'sent' ? 'sentAt' :
    newStatus === 'viewed' ? 'viewedAt' :
    newStatus === 'paid' ? 'paidAt' : null;

  const updateExpr = timestampField
    ? `SET #status = :s, ${timestampField} = :ts, updatedAt = :ts, gsi1sk = :gsi1sk`
    : 'SET #status = :s, updatedAt = :ts, gsi1sk = :gsi1sk';

  const { Attributes } = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: Keys.invoice.pk(userId), sk: Keys.invoice.sk(invoiceId) },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':s': newStatus,
        ':ts': now,
        ':gsi1sk': Keys.invoice.gsi1sk(newStatus, existing.createdAt),
      },
      ReturnValues: 'ALL_NEW',
    }),
  );
  logger.info('Invoice status transitioned', { userId, invoiceId, newStatus });
  return toInvoice(Attributes as Invoice);
}

async function incrementInvoiceCounter(userId: string): Promise<number> {
  const { Attributes } = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: Keys.invoiceCounter.pk(userId), sk: Keys.invoiceCounter.sk() },
      UpdateExpression: 'ADD #count :inc',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: { ':inc': 1 },
      ReturnValues: 'UPDATED_NEW',
    }),
  );
  return Attributes?.['count'] as number;
}

function toInvoice(item: Record<string, unknown>): Invoice {
  return {
    invoiceId: item['invoiceId'] as string,
    userId: item['userId'] as string,
    clientId: item['clientId'] as string,
    invoiceNumber: item['invoiceNumber'] as string,
    status: item['status'] as InvoiceStatus,
    issueDate: item['issueDate'] as string,
    dueDate: item['dueDate'] as string,
    currency: 'AUD',
    lineItems: item['lineItems'] as Invoice['lineItems'],
    subtotal: item['subtotal'] as number,
    taxTotal: item['taxTotal'] as number,
    grandTotal: item['grandTotal'] as number,
    notes: (item['notes'] as string | null) ?? null,
    createdAt: item['createdAt'] as string,
    updatedAt: item['updatedAt'] as string,
    sentAt: (item['sentAt'] as string | null) ?? null,
    viewedAt: (item['viewedAt'] as string | null) ?? null,
    paidAt: (item['paidAt'] as string | null) ?? null,
    deletedAt: (item['deletedAt'] as string | null) ?? null,
  };
}
