import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { setRequestId } from '../../shared/utils/logger';
import { buildResponse } from '../../shared/utils/response';
import { handleError } from '../../shared/utils/error-handler';
import { getUserId } from '../../shared/middleware/auth-middleware';
import { getDashboardSummary } from '../services/dashboard-service';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  setRequestId(event.requestContext.requestId);
  try {
    const userId = getUserId(event);
    const summary = await getDashboardSummary(userId);
    return buildResponse(200, summary);
  } catch (err) {
    return handleError(err);
  }
};
