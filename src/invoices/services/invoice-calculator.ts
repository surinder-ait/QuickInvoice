/**
 * Pure invoice calculation functions — property-based testable (NFR-06.2).
 * All monetary values in integer cents (AUD) to avoid floating-point errors.
 */
import {
  LineItem,
  InvoiceTotals,
  InvoiceStatus,
} from '../../shared/types/index';
import { AppError } from '../../shared/utils/error-handler';

/**
 * Calculate subtotal: sum of (quantity × unitPrice) across all line items.
 * unitPrice is already in cents. Result is integer cents.
 */
export function calculateSubtotal(lineItems: LineItem[]): number {
  return lineItems.reduce((sum, item) => {
    return sum + Math.round(item.quantity * item.unitPrice);
  }, 0);
}

/**
 * Calculate tax total: sum of (quantity × unitPrice × taxRate / 100) across all line items.
 * Result is integer cents, rounded per line item.
 */
export function calculateTaxTotal(lineItems: LineItem[]): number {
  return lineItems.reduce((sum, item) => {
    const lineTotal = Math.round(item.quantity * item.unitPrice);
    return sum + Math.round((lineTotal * item.taxRate) / 100);
  }, 0);
}

/** Calculate grand total: subtotal + taxTotal. */
export function calculateGrandTotal(subtotal: number, taxTotal: number): number {
  return subtotal + taxTotal;
}

/** Compute all three totals from line items. */
export function calculateTotals(lineItems: LineItem[]): InvoiceTotals {
  const subtotal = calculateSubtotal(lineItems);
  const taxTotal = calculateTaxTotal(lineItems);
  return {
    subtotal,
    taxTotal,
    grandTotal: calculateGrandTotal(subtotal, taxTotal),
  };
}

/**
 * Format an invoice number from prefix and counter.
 * e.g. ("INV", 7) → "INV-007", ("ACME", 42) → "ACME-042"
 */
export function formatInvoiceNumber(prefix: string, counter: number): string {
  return `${prefix.toUpperCase()}-${String(counter).padStart(3, '0')}`;
}

/** Valid invoice status transitions. */
const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent'],
  sent: ['viewed', 'paid'],
  viewed: ['paid'],
  paid: [],
};

/** Returns true if the transition from current → next is valid. */
export function isValidStatusTransition(
  current: InvoiceStatus,
  next: InvoiceStatus,
): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

/** Throws if the transition is invalid. */
export function validateStatusTransition(
  current: InvoiceStatus,
  next: InvoiceStatus,
): void {
  if (!isValidStatusTransition(current, next)) {
    throw new AppError(
      409,
      `Cannot transition invoice from '${current}' to '${next}'`,
    );
  }
}
