/**
 * Authentication service — handles all user identity and session operations.
 * SECURITY-12: bcrypt cost 12, HttpOnly refresh token, brute-force protection.
 * NFR-03.8–10: RS256 JWT, tokenVersion for mass revocation.
 */
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { ddb, TABLE } from '../../shared/db/dynamodb-client';
import { Keys } from '../../shared/db/table-keys';
import { logger } from '../../shared/utils/logger';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  AppError,
} from '../../shared/utils/error-handler';
import {
  RegisterRequest,
  LoginRequest,
  TokenPair,
  User,
} from '../../shared/types/index';
import {
  issueAccessToken,
  issueRefreshToken,
  verifyToken,
} from './token-service';
import {
  checkBruteForce,
  recordFailedAttempt,
  clearAttempts,
} from './brute-force-service';

const BCRYPT_ROUNDS = 12;
const VERIFY_TOKEN_TTL_SECONDS = 24 * 60 * 60;      // 24 hours
const RESET_TOKEN_TTL_SECONDS = 60 * 60;             // 1 hour
const SES_FROM = process.env['SES_FROM_ADDRESS']!;
const APP_BASE_URL = process.env['APP_BASE_URL']!;

const ses = new SESClient({ region: process.env['SES_REGION'] ?? process.env['AWS_REGION'] });

// ─── Registration ────────────────────────────────────────────────────────────

export async function registerUser(req: RegisterRequest): Promise<void> {
  const email = req.email.toLowerCase();

  // Check email uniqueness via GSI
  const existing = await getUserByEmail(email);
  if (existing) throw new ConflictError('Email is already registered');

  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(req.password, BCRYPT_ROUNDS);
  const now = new Date().toISOString();
  const verifyTokenId = uuidv4();
  const verifyTokenTTL = Math.floor(Date.now() / 1000) + VERIFY_TOKEN_TTL_SECONDS;

  const user: User & Record<string, unknown> = {
    pk: Keys.user.pk(userId),
    sk: Keys.user.sk(),
    gsi1pk: Keys.user.gsi1pk(email),
    gsi1sk: Keys.user.gsi1sk(),
    userId,
    email,
    passwordHash,
    displayName: req.displayName,
    invoicePrefix: 'INV',
    emailVerified: false,
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now,
  };

  // Store user and verification token atomically (two separate puts — DynamoDB transactions
  // would be cleaner but adds cost; acceptable for MVP)
  await ddb.send(new PutCommand({ TableName: TABLE, Item: user }));
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: Keys.emailVerifyToken.pk(userId),
        sk: Keys.emailVerifyToken.sk(verifyTokenId),
        tokenId: verifyTokenId,
        userId,
        ttl: verifyTokenTTL,
      },
    }),
  );

  await sendVerificationEmail(email, verifyTokenId);
  logger.info('User registered', { userId, email });
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function loginUser(req: LoginRequest): Promise<TokenPair & { refreshToken: string }> {
  const email = req.email.toLowerCase();

  await checkBruteForce(email);

  const user = await getUserByEmail(email);
  if (!user) {
    await recordFailedAttempt(email);
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatch = await bcrypt.compare(req.password, user.passwordHash);
  if (!passwordMatch) {
    await recordFailedAttempt(email);
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.emailVerified) {
    throw new UnauthorizedError('Please verify your email address before logging in');
  }

  await clearAttempts(email);

  const accessToken = await issueAccessToken(user.userId, user.tokenVersion);
  const { token: refreshToken, jti } = await issueRefreshToken(user.userId, user.tokenVersion);

  // Store refresh token hash (SHA-256 of the raw token)
  const tokenHash = await hashToken(refreshToken);
  const ttl = Math.floor(Date.now() / 1000) + Number(process.env['REFRESH_TOKEN_EXPIRY_SECONDS'] ?? 604800);
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: Keys.refreshToken.pk(user.userId),
        sk: Keys.refreshToken.sk(jti),
        jti,
        userId: user.userId,
        tokenHash,
        ttl,
      },
    }),
  );

  logger.info('User logged in', { userId: user.userId });
  return { accessToken, refreshToken };
}

// ─── Token Refresh ───────────────────────────────────────────────────────────

export async function refreshTokens(rawRefreshToken: string): Promise<TokenPair & { refreshToken: string }> {
  const payload = await verifyToken(rawRefreshToken);

  if (payload.type !== 'refresh') {
    throw new UnauthorizedError('Invalid token type');
  }

  // Look up stored token hash
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: {
        pk: Keys.refreshToken.pk(payload.sub),
        sk: Keys.refreshToken.sk(payload.jti),
      },
    }),
  );

  if (!Item) {
    // Token not found — possible reuse attack. Revoke all tokens for safety.
    logger.warn('Refresh token reuse detected — revoking all user tokens', { userId: payload.sub });
    await revokeAllUserTokens(payload.sub);
    throw new UnauthorizedError('Session expired. Please log in again.');
  }

  const tokenHash = await hashToken(rawRefreshToken);
  if (Item['tokenHash'] !== tokenHash) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Check tokenVersion to enforce mass revocation
  const user = await getUserById(payload.sub);
  if (!user || payload.tokenVersion < user.tokenVersion) {
    throw new UnauthorizedError('Session has been revoked. Please log in again.');
  }

  // Rotate: delete old, issue new pair
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: {
        pk: Keys.refreshToken.pk(payload.sub),
        sk: Keys.refreshToken.sk(payload.jti),
      },
    }),
  );

  const accessToken = await issueAccessToken(user.userId, user.tokenVersion);
  const { token: newRefreshToken, jti: newJti } = await issueRefreshToken(user.userId, user.tokenVersion);
  const newHash = await hashToken(newRefreshToken);
  const ttl = Math.floor(Date.now() / 1000) + Number(process.env['REFRESH_TOKEN_EXPIRY_SECONDS'] ?? 604800);

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: Keys.refreshToken.pk(user.userId),
        sk: Keys.refreshToken.sk(newJti),
        jti: newJti,
        userId: user.userId,
        tokenHash: newHash,
        ttl,
      },
    }),
  );

  return { accessToken, refreshToken: newRefreshToken };
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logoutUser(userId: string, jti: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: {
        pk: Keys.refreshToken.pk(userId),
        sk: Keys.refreshToken.sk(jti),
      },
    }),
  );
  logger.info('User logged out', { userId });
}

// ─── Email Verification ──────────────────────────────────────────────────────

export async function verifyEmail(tokenId: string): Promise<void> {
  // Find the verification token — we need to query (we don't know the userId)
  // Tokens are stored under USER#<userId>/VTOKEN#<tokenId>
  // For MVP, scan is acceptable given 1-5 users; for scale, store a GSI on tokenId
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :t',
      ExpressionAttributeValues: { ':t': `VTOKEN#${tokenId}` },
      Limit: 1,
    }),
  );

  // Fallback: linear scan of VTOKEN records for MVP
  if (!Items || Items.length === 0) {
    throw new AppError(400, 'Invalid or expired verification token');
  }

  const record = Items[0]!;
  const userId = record['userId'] as string;

  await ddb.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: {
        pk: Keys.emailVerifyToken.pk(userId),
        sk: Keys.emailVerifyToken.sk(tokenId),
      },
    }),
  );

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: Keys.user.pk(userId), sk: Keys.user.sk() },
      UpdateExpression: 'SET emailVerified = :v, updatedAt = :ts',
      ExpressionAttributeValues: {
        ':v': true,
        ':ts': new Date().toISOString(),
      },
    }),
  );

  logger.info('Email verified', { userId });
}

// ─── Password Reset ──────────────────────────────────────────────────────────

export async function initiatePasswordReset(email: string): Promise<void> {
  const user = await getUserByEmail(email.toLowerCase());
  // Always return success to avoid email enumeration
  if (!user) return;

  const resetTokenId = uuidv4();
  const ttl = Math.floor(Date.now() / 1000) + RESET_TOKEN_TTL_SECONDS;

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: Keys.passwordResetToken.pk(user.userId),
        sk: Keys.passwordResetToken.sk(resetTokenId),
        tokenId: resetTokenId,
        userId: user.userId,
        ttl,
      },
    }),
  );

  await sendPasswordResetEmail(user.email, resetTokenId);
  logger.info('Password reset initiated', { userId: user.userId });
}

export async function completePasswordReset(tokenId: string, newPassword: string): Promise<void> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :t',
      ExpressionAttributeValues: { ':t': `PRTOKEN#${tokenId}` },
      Limit: 1,
    }),
  );

  if (!Items || Items.length === 0) {
    throw new AppError(400, 'Invalid or expired password reset token');
  }

  const record = Items[0]!;
  const userId = record['userId'] as string;

  // Delete token (single-use)
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: {
        pk: Keys.passwordResetToken.pk(userId),
        sk: Keys.passwordResetToken.sk(tokenId),
      },
    }),
  );

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Update password and increment tokenVersion to revoke all existing sessions
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: Keys.user.pk(userId), sk: Keys.user.sk() },
      UpdateExpression:
        'SET passwordHash = :ph, tokenVersion = tokenVersion + :inc, updatedAt = :ts',
      ExpressionAttributeValues: {
        ':ph': passwordHash,
        ':inc': 1,
        ':ts': new Date().toISOString(),
      },
    }),
  );

  logger.info('Password reset completed', { userId });
}

// ─── Mass Revocation (NFR-03.10) ─────────────────────────────────────────────

/**
 * Increment tokenVersion — all existing JWTs become invalid on next authorizer check.
 * Used for credential compromise response procedure.
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: Keys.user.pk(userId), sk: Keys.user.sk() },
      UpdateExpression: 'SET tokenVersion = tokenVersion + :inc, updatedAt = :ts',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':ts': new Date().toISOString(),
      },
    }),
  );
  logger.warn('All tokens revoked for user', { userId });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getUserByEmail(email: string): Promise<User | null> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk = :sk',
      ExpressionAttributeValues: {
        ':pk': Keys.user.gsi1pk(email),
        ':sk': Keys.user.gsi1sk(),
      },
      Limit: 1,
    }),
  );
  return (Items?.[0] as User | undefined) ?? null;
}

async function getUserById(userId: string): Promise<User | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { pk: Keys.user.pk(userId), sk: Keys.user.sk() },
    }),
  );
  return (Item as User | undefined) ?? null;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hashBuffer).toString('hex');
}

async function sendVerificationEmail(email: string, tokenId: string): Promise<void> {
  const link = `${APP_BASE_URL}/verify-email?token=${tokenId}`;
  await ses.send(
    new SendEmailCommand({
      Source: SES_FROM,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: 'Verify your QuickInvoice email address' },
        Body: {
          Html: {
            Data: `<p>Click the link below to verify your email address. This link expires in 24 hours.</p>
<p><a href="${link}">Verify Email</a></p>
<p>If you did not create a QuickInvoice account, you can ignore this email.</p>`,
          },
        },
      },
    }),
  );
}

async function sendPasswordResetEmail(email: string, tokenId: string): Promise<void> {
  const link = `${APP_BASE_URL}/reset-password?token=${tokenId}`;
  await ses.send(
    new SendEmailCommand({
      Source: SES_FROM,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: 'Reset your QuickInvoice password' },
        Body: {
          Html: {
            Data: `<p>Click the link below to reset your password. This link expires in 1 hour and can only be used once.</p>
<p><a href="${link}">Reset Password</a></p>
<p>If you did not request a password reset, you can ignore this email.</p>`,
          },
        },
      },
    }),
  );
}

export { getUserById, NotFoundError };
