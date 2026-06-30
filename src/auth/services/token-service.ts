/**
 * RS256 JWT token service.
 * NFR-03.8: Asymmetric RS256 keys — private key signs, public key verifies.
 * NFR-03.9: Key rotation supported — JWTAuthorizer re-fetches public key on verify failure.
 * NFR-03.10: tokenVersion claim enables mass revocation without key rotation.
 */
import jwt from 'jsonwebtoken';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { logger } from '../../shared/utils/logger';
import { UnauthorizedError } from '../../shared/utils/error-handler';

const smClient = new SecretsManagerClient({ region: process.env['AWS_REGION'] });

// Module-scope cache — survives Lambda warm invocations
let _privateKey: string | null = null;
let _publicKey: string | null = null;

const PRIVATE_KEY_ARN = process.env['JWT_PRIVATE_KEY_SECRET_ARN']!;
const PUBLIC_KEY_ARN = process.env['JWT_PUBLIC_KEY_SECRET_ARN']!;
const ISSUER = process.env['JWT_ISSUER'] ?? 'quickinvoice';
const AUDIENCE = process.env['JWT_AUDIENCE'] ?? 'quickinvoice-api';
const ACCESS_EXPIRY = Number(process.env['ACCESS_TOKEN_EXPIRY_SECONDS'] ?? 900);
const REFRESH_EXPIRY = Number(process.env['REFRESH_TOKEN_EXPIRY_SECONDS'] ?? 604800);

async function fetchSecret(arn: string): Promise<string> {
  const { SecretString } = await smClient.send(
    new GetSecretValueCommand({ SecretId: arn }),
  );
  if (!SecretString) throw new Error(`Secret ${arn} has no string value`);
  return SecretString;
}

export async function getPrivateKey(): Promise<string> {
  if (!_privateKey) {
    logger.info('Fetching JWT private key from Secrets Manager');
    _privateKey = await fetchSecret(PRIVATE_KEY_ARN);
  }
  return _privateKey;
}

export async function getPublicKey(forceRefresh = false): Promise<string> {
  if (!_publicKey || forceRefresh) {
    logger.info('Fetching JWT public key from Secrets Manager');
    _publicKey = await fetchSecret(PUBLIC_KEY_ARN);
  }
  return _publicKey;
}

/** Invalidate cached keys (called after rotation). */
export function invalidateKeyCache(): void {
  _privateKey = null;
  _publicKey = null;
}

export interface TokenPayload {
  sub: string;       // userId
  tokenVersion: number;
  type: 'access' | 'refresh';
  jti: string;       // unique token ID (for refresh token revocation)
}

export async function issueAccessToken(
  userId: string,
  tokenVersion: number,
): Promise<string> {
  const key = await getPrivateKey();
  return jwt.sign(
    { sub: userId, tokenVersion, type: 'access' } satisfies Partial<TokenPayload>,
    key,
    {
      algorithm: 'RS256',
      expiresIn: ACCESS_EXPIRY,
      issuer: ISSUER,
      audience: AUDIENCE,
      jwtid: crypto.randomUUID(),
    },
  );
}

export async function issueRefreshToken(
  userId: string,
  tokenVersion: number,
): Promise<{ token: string; jti: string }> {
  const key = await getPrivateKey();
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: userId, tokenVersion, type: 'refresh', jti } satisfies TokenPayload,
    key,
    {
      algorithm: 'RS256',
      expiresIn: REFRESH_EXPIRY,
      issuer: ISSUER,
      audience: AUDIENCE,
      jwtid: jti,
    },
  );
  return { token, jti };
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  let publicKey = await getPublicKey();
  try {
    return jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as TokenPayload;
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      // NFR-03.9: On verify failure, attempt one key cache refresh (handles rotation)
      publicKey = await getPublicKey(true);
      try {
        return jwt.verify(token, publicKey, {
          algorithms: ['RS256'],
          issuer: ISSUER,
          audience: AUDIENCE,
        }) as TokenPayload;
      } catch {
        throw new UnauthorizedError('Invalid or expired token');
      }
    }
    throw new UnauthorizedError('Invalid or expired token');
  }
}
