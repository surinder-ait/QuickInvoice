import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { setRequestId, logger } from '../../shared/utils/logger';
import { buildResponse } from '../../shared/utils/response';
import { handleError } from '../../shared/utils/error-handler';
import { getUserId } from '../../shared/middleware/auth-middleware';
import {
  parseBody,
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../../shared/utils/validation';
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  verifyEmail,
  initiatePasswordReset,
  completePasswordReset,
} from '../services/auth-service';

const REFRESH_COOKIE_MAX_AGE = Number(process.env['REFRESH_TOKEN_EXPIRY_SECONDS'] ?? 604800);

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  setRequestId(event.requestContext.requestId);
  const method = event.httpMethod;
  const path = event.resource;

  try {
    // POST /auth/register
    if (method === 'POST' && path === '/auth/register') {
      const req = parseBody(RegisterSchema, event.body);
      await registerUser(req);
      return buildResponse(201, { message: 'Registration successful. Please check your email to verify your account.' });
    }

    // POST /auth/login
    if (method === 'POST' && path === '/auth/login') {
      const req = parseBody(LoginSchema, event.body);
      const { accessToken, refreshToken } = await loginUser(req);
      return buildResponse(200, { accessToken }, {
        'Set-Cookie': `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${REFRESH_COOKIE_MAX_AGE}; Path=/auth/refresh`,
      });
    }

    // POST /auth/logout
    if (method === 'POST' && path === '/auth/logout') {
      const userId = getUserId(event);
      const jti = (event.requestContext.authorizer?.['jti'] as string) ?? '';
      await logoutUser(userId, jti);
      return buildResponse(200, { message: 'Logged out successfully' }, {
        'Set-Cookie': 'refreshToken=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/auth/refresh',
      });
    }

    // POST /auth/refresh
    if (method === 'POST' && path === '/auth/refresh') {
      const cookieHeader = event.headers['Cookie'] ?? event.headers['cookie'] ?? '';
      const match = cookieHeader.match(/refreshToken=([^;]+)/);
      if (!match) {
        return buildResponse(401, { error: 'No refresh token provided' });
      }
      const { accessToken, refreshToken } = await refreshTokens(match[1]!);
      return buildResponse(200, { accessToken }, {
        'Set-Cookie': `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${REFRESH_COOKIE_MAX_AGE}; Path=/auth/refresh`,
      });
    }

    // GET /auth/verify-email
    if (method === 'GET' && path === '/auth/verify-email') {
      const token = event.queryStringParameters?.['token'];
      if (!token) return buildResponse(400, { error: 'token query parameter is required' });
      await verifyEmail(token);
      return buildResponse(200, { message: 'Email verified successfully. You can now log in.' });
    }

    // POST /auth/forgot-password
    if (method === 'POST' && path === '/auth/forgot-password') {
      const { email } = parseBody(ForgotPasswordSchema, event.body);
      await initiatePasswordReset(email);
      return buildResponse(200, { message: 'If that email is registered, a reset link has been sent.' });
    }

    // POST /auth/reset-password
    if (method === 'POST' && path === '/auth/reset-password') {
      const { token, newPassword } = parseBody(ResetPasswordSchema, event.body);
      await completePasswordReset(token, newPassword);
      return buildResponse(200, { message: 'Password reset successfully. Please log in.' });
    }

    logger.warn('No route matched', { method, path });
    return buildResponse(404, { error: 'Not found' });
  } catch (err) {
    return handleError(err);
  }
};
