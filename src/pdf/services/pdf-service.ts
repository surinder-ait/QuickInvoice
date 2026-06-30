import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../../shared/db/dynamodb-client';
import { Keys } from '../../shared/db/table-keys';
import { Invoice, Client } from '../../shared/types/index';
import { NotFoundError, ForbiddenError } from '../../shared/utils/error-handler';
import { renderInvoicePDF } from '../templates/invoice-template';

export async function generateInvoicePDF(
  userId: string,
  invoiceId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  // Fetch invoice
  const { Item: invoiceItem } = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { pk: Keys.invoice.pk(userId), sk: Keys.invoice.sk(invoiceId) },
    }),
  );
  if (!invoiceItem || invoiceItem['deletedAt']) throw new NotFoundError('Invoice');
  if (invoiceItem['userId'] !== userId) throw new ForbiddenError();

  const invoice = invoiceItem as Invoice;

  // Fetch client
  const { Item: clientItem } = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: {
        pk: Keys.client.pk(userId),
        sk: Keys.client.sk(invoice.clientId),
      },
    }),
  );
  if (!clientItem) throw new NotFoundError('Client');

  const client = clientItem as Client;
  const buffer = await renderInvoicePDF(invoice, client);
  const filename = `${invoice.invoiceNumber}.pdf`;

  return { buffer, filename };
}
