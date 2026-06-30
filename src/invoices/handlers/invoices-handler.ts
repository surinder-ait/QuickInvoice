import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { setRequestId } from '../../shared/utils/logger';
import { buildResponse } from '../../shared/utils/response';
import { handleError } from '../../shared/utils/error-handler';
import { getUserId } from '../../shared/middleware/auth-middleware';
import {
  parseBody,
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
  StatusTransitionSchema,
} from '../../shared/utils/validation';
import {
  createInvoice,
  listInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  duplicateInvoice,
  transitionStatus,
} from '../services/invoice-service';
import { InvoiceStatus } from '../../shared/types/index';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  setRequestId(event.requestContext.requestId);
  const method = event.httpMethod;
  const path = event.resource;
  const invoiceId = event.pathParameters?.['id'];

  try {
    const userId = getUserId(event);

    if (method === 'GET' && path === '/invoices') {
      const status = event.queryStringParameters?.['status'] as InvoiceStatus | undefined;
      const invoices = await listInvoices(userId, status);
      return buildResponse(200, invoices);
    }

    if (method === 'POST' && path === '/invoices') {
      const req = parseBody(CreateInvoiceSchema, event.body);
      const invoice = await createInvoice(userId, req);
      return buildResponse(201, invoice);
    }

    if (method === 'GET' && path === '/invoices/{id}' && invoiceId) {
      const invoice = await getInvoice(userId, invoiceId);
      return buildResponse(200, invoice);
    }

    if (method === 'PUT' && path === '/invoices/{id}' && invoiceId) {
      const req = parseBody(UpdateInvoiceSchema, event.body);
      const invoice = await updateInvoice(userId, invoiceId, req);
      return buildResponse(200, invoice);
    }

    if (method === 'DELETE' && path === '/invoices/{id}' && invoiceId) {
      await deleteInvoice(userId, invoiceId);
      return buildResponse(204, null);
    }

    if (method === 'POST' && path === '/invoices/{id}/duplicate' && invoiceId) {
      const invoice = await duplicateInvoice(userId, invoiceId);
      return buildResponse(201, invoice);
    }

    if (method === 'PATCH' && path === '/invoices/{id}/status' && invoiceId) {
      const { status } = parseBody(StatusTransitionSchema, event.body);
      const invoice = await transitionStatus(userId, invoiceId, status);
      return buildResponse(200, invoice);
    }

    return buildResponse(404, { error: 'Not found' });
  } catch (err) {
    return handleError(err);
  }
};
