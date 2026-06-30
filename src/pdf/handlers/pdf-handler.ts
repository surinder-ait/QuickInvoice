import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { setRequestId } from '../../shared/utils/logger';
import { buildPDFResponse } from '../../shared/utils/response';
import { handleError } from '../../shared/utils/error-handler';
import { getUserId } from '../../shared/middleware/auth-middleware';
import { generateInvoicePDF } from '../services/pdf-service';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  setRequestId(event.requestContext.requestId);
  try {
    const userId = getUserId(event);
    const invoiceId = event.pathParameters?.['id'];
    if (!invoiceId) return { statusCode: 400, headers: {}, body: JSON.stringify({ error: 'Invoice ID required' }) };

    const { buffer, filename } = await generateInvoicePDF(userId, invoiceId);
    return buildPDFResponse(buffer, filename);
  } catch (err) {
    return handleError(err);
  }
};
