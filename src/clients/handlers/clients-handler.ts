import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { setRequestId } from '../../shared/utils/logger';
import { buildResponse } from '../../shared/utils/response';
import { handleError } from '../../shared/utils/error-handler';
import { getUserId } from '../../shared/middleware/auth-middleware';
import {
  parseBody,
  CreateClientSchema,
  UpdateClientSchema,
} from '../../shared/utils/validation';
import {
  createClient,
  listClients,
  getClient,
  updateClient,
  deleteClient,
} from '../services/client-service';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  setRequestId(event.requestContext.requestId);
  const method = event.httpMethod;
  const path = event.resource;
  const clientId = event.pathParameters?.['id'];

  try {
    const userId = getUserId(event);

    if (method === 'GET' && path === '/clients') {
      const clients = await listClients(userId);
      return buildResponse(200, clients);
    }

    if (method === 'POST' && path === '/clients') {
      const req = parseBody(CreateClientSchema, event.body);
      const client = await createClient(userId, req);
      return buildResponse(201, client);
    }

    if (method === 'GET' && path === '/clients/{id}' && clientId) {
      const client = await getClient(userId, clientId);
      return buildResponse(200, client);
    }

    if (method === 'PUT' && path === '/clients/{id}' && clientId) {
      const req = parseBody(UpdateClientSchema, event.body);
      const client = await updateClient(userId, clientId, req);
      return buildResponse(200, client);
    }

    if (method === 'DELETE' && path === '/clients/{id}' && clientId) {
      await deleteClient(userId, clientId);
      return buildResponse(204, null);
    }

    return buildResponse(404, { error: 'Not found' });
  } catch (err) {
    return handleError(err);
  }
};
