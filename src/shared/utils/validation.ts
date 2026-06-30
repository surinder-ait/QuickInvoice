import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
  displayName: z.string().min(1).max(100).trim(),
});

export const LoginSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(1).max(128),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().uuid(),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
});

// ─── Clients ─────────────────────────────────────────────────────────────────

export const CreateClientSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  email: z.string().email().max(254).toLowerCase(),
});

export const UpdateClientSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  email: z.string().email().max(254).toLowerCase().optional(),
}).refine((d) => d.name !== undefined || d.email !== undefined, {
  message: 'At least one field must be provided',
});

// ─── Invoices ────────────────────────────────────────────────────────────────

const LineItemSchema = z.object({
  description: z.string().min(1).max(500).trim(),
  quantity: z.number().positive().max(1_000_000),
  unitPrice: z.number().int().nonnegative().max(100_000_000_00), // max $1B cents
  taxRate: z.number().min(0).max(100),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CreateInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  issueDate: z.string().regex(ISO_DATE, 'issueDate must be YYYY-MM-DD'),
  dueDate: z.string().regex(ISO_DATE, 'dueDate must be YYYY-MM-DD'),
  lineItems: z.array(LineItemSchema).min(1).max(100),
  notes: z.string().max(2000).optional(),
});

export const UpdateInvoiceSchema = z.object({
  clientId: z.string().uuid().optional(),
  issueDate: z.string().regex(ISO_DATE).optional(),
  dueDate: z.string().regex(ISO_DATE).optional(),
  lineItems: z.array(LineItemSchema).min(1).max(100).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const StatusTransitionSchema = z.object({
  status: z.enum(['sent', 'paid']),
});

// ─── Users ───────────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).trim().optional(),
  invoicePrefix: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9]+$/i, 'Invoice prefix must be alphanumeric')
    .toUpperCase()
    .optional(),
}).refine((d) => d.displayName !== undefined || d.invoicePrefix !== undefined, {
  message: 'At least one field must be provided',
});

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Parse and validate a request body. Throws a 400-ready error on failure.
 */
export function parseBody<T>(schema: z.ZodType<T>, body: string | null): T {
  if (!body) throw new ValidationError('Request body is required');
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const message = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new ValidationError(message);
  }
  return result.data;
}

export class ValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
