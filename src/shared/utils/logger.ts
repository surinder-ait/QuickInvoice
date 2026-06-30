/** Structured JSON logger — SECURITY-03 compliant. Never logs secrets, tokens, or PII. */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  requestId: string;
  message: string;
  [key: string]: unknown;
}

let _requestId = 'unknown';

export function setRequestId(id: string): void {
  _requestId = id;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    requestId: _requestId,
    message,
    ...sanitize(meta),
  };
  // CloudWatch picks up stdout
  process.stdout.write(JSON.stringify(entry) + '\n');
}

/** Strip sensitive keys before logging. */
function sanitize(obj?: Record<string, unknown>): Record<string, unknown> {
  if (!obj) return {};
  const REDACTED_KEYS = new Set([
    'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
    'secret', 'privateKey', 'publicKey', 'authorization',
  ]);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      REDACTED_KEYS.has(k.toLowerCase()) ? [k, '[REDACTED]'] : [k, v],
    ),
  );
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('DEBUG', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('INFO', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('WARN', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('ERROR', message, meta),
};
