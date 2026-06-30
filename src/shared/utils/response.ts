import { APIGatewayProxyResult } from 'aws-lambda';

/** SECURITY-04: security headers on all responses */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'none'",
  'Cache-Control': 'no-store',
};

export function buildResponse(
  statusCode: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { ...SECURITY_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

export function buildPDFResponse(buffer: Buffer, filename: string): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true,
  };
}
