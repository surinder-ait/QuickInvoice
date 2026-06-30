/**
 * Property-based tests for invoice-calculator.ts — NFR-06.2.
 * Uses fast-check to verify mathematical invariants over arbitrary inputs.
 */
import * as fc from 'fast-check';
import {
  calculateSubtotal,
  calculateTaxTotal,
  calculateGrandTotal,
  calculateTotals,
  formatInvoiceNumber,
  isValidStatusTransition,
  validateStatusTransition,
} from '../../../src/invoices/services/invoice-calculator';
import { LineItem, InvoiceStatus } from '../../../src/shared/types/index';
import { AppError } from '../../../src/shared/utils/error-handler';

// Arbitrary for a single valid line item
const lineItemArb = fc.record<LineItem>({
  description: fc.string({ minLength: 1, maxLength: 100 }),
  quantity: fc.float({ min: 0.01, max: 1000, noNaN: true }),
  unitPrice: fc.integer({ min: 0, max: 10_000_000 }), // cents, max $100k
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
});

const lineItemsArb = fc.array(lineItemArb, { minLength: 1, maxLength: 20 });

// ─── calculateSubtotal ────────────────────────────────────────────────────────

describe('calculateSubtotal', () => {
  test('PBT: always non-negative for valid inputs', () => {
    fc.assert(
      fc.property(lineItemsArb, (items) => {
        expect(calculateSubtotal(items)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  test('PBT: result is an integer (cents, no floating point)', () => {
    fc.assert(
      fc.property(lineItemsArb, (items) => {
        const result = calculateSubtotal(items);
        expect(Number.isInteger(result)).toBe(true);
      }),
    );
  });

  test('PBT: single item subtotal equals round(quantity * unitPrice)', () => {
    fc.assert(
      fc.property(lineItemArb, (item) => {
        const result = calculateSubtotal([item]);
        expect(result).toBe(Math.round(item.quantity * item.unitPrice));
      }),
    );
  });

  test('PBT: subtotal of combined items equals sum of individual subtotals', () => {
    fc.assert(
      fc.property(lineItemsArb, lineItemsArb, (a, b) => {
        const combined = calculateSubtotal([...a, ...b]);
        const separate = calculateSubtotal(a) + calculateSubtotal(b);
        expect(combined).toBe(separate);
      }),
    );
  });

  test('empty array returns 0', () => {
    expect(calculateSubtotal([])).toBe(0);
  });
});

// ─── calculateTaxTotal ────────────────────────────────────────────────────────

describe('calculateTaxTotal', () => {
  test('PBT: always non-negative', () => {
    fc.assert(
      fc.property(lineItemsArb, (items) => {
        expect(calculateTaxTotal(items)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  test('PBT: result is an integer', () => {
    fc.assert(
      fc.property(lineItemsArb, (items) => {
        expect(Number.isInteger(calculateTaxTotal(items))).toBe(true);
      }),
    );
  });

  test('PBT: zero tax rate always produces zero tax', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record<LineItem>({
            description: fc.string({ minLength: 1 }),
            quantity: fc.float({ min: 0.01, max: 1000, noNaN: true }),
            unitPrice: fc.integer({ min: 0, max: 10_000_000 }),
            taxRate: fc.constant(0),
          }),
          { minLength: 1 },
        ),
        (items) => {
          expect(calculateTaxTotal(items)).toBe(0);
        },
      ),
    );
  });
});

// ─── calculateGrandTotal ─────────────────────────────────────────────────────

describe('calculateGrandTotal', () => {
  test('PBT: grandTotal === subtotal + taxTotal', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (subtotal, taxTotal) => {
          expect(calculateGrandTotal(subtotal, taxTotal)).toBe(subtotal + taxTotal);
        },
      ),
    );
  });
});

// ─── calculateTotals ─────────────────────────────────────────────────────────

describe('calculateTotals', () => {
  test('PBT: grandTotal === subtotal + taxTotal for all inputs', () => {
    fc.assert(
      fc.property(lineItemsArb, (items) => {
        const { subtotal, taxTotal, grandTotal } = calculateTotals(items);
        expect(grandTotal).toBe(subtotal + taxTotal);
      }),
    );
  });

  test('PBT: all totals are non-negative integers', () => {
    fc.assert(
      fc.property(lineItemsArb, (items) => {
        const { subtotal, taxTotal, grandTotal } = calculateTotals(items);
        expect(subtotal).toBeGreaterThanOrEqual(0);
        expect(taxTotal).toBeGreaterThanOrEqual(0);
        expect(grandTotal).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(subtotal)).toBe(true);
        expect(Number.isInteger(taxTotal)).toBe(true);
        expect(Number.isInteger(grandTotal)).toBe(true);
      }),
    );
  });
});

// ─── formatInvoiceNumber ─────────────────────────────────────────────────────

describe('formatInvoiceNumber', () => {
  test('PBT: always matches PREFIX-NNN pattern', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).map((s) => s.replace(/[^A-Za-z0-9]/g, 'X') || 'INV'),
        fc.integer({ min: 1, max: 9999 }),
        (prefix, counter) => {
          const result = formatInvoiceNumber(prefix, counter);
          expect(result).toMatch(/^[A-Z0-9]+-\d{3,}$/);
        },
      ),
    );
  });

  test('single digit counter is padded to 3 digits', () => {
    expect(formatInvoiceNumber('INV', 1)).toBe('INV-001');
    expect(formatInvoiceNumber('INV', 9)).toBe('INV-009');
  });

  test('three digit counter is not padded', () => {
    expect(formatInvoiceNumber('INV', 100)).toBe('INV-100');
  });

  test('four digit counter is not truncated', () => {
    expect(formatInvoiceNumber('INV', 1000)).toBe('INV-1000');
  });

  test('prefix is uppercased', () => {
    expect(formatInvoiceNumber('acme', 1)).toBe('ACME-001');
  });
});

// ─── Status transitions ──────────────────────────────────────────────────────

describe('isValidStatusTransition', () => {
  const validTransitions: [InvoiceStatus, InvoiceStatus][] = [
    ['draft', 'sent'],
    ['sent', 'viewed'],
    ['sent', 'paid'],
    ['viewed', 'paid'],
  ];

  const invalidTransitions: [InvoiceStatus, InvoiceStatus][] = [
    ['draft', 'paid'],
    ['draft', 'viewed'],
    ['draft', 'draft'],
    ['paid', 'sent'],
    ['paid', 'draft'],
    ['paid', 'viewed'],
    ['viewed', 'sent'],
    ['viewed', 'draft'],
    ['sent', 'draft'],
  ];

  test.each(validTransitions)('%s → %s is valid', (from, to) => {
    expect(isValidStatusTransition(from, to)).toBe(true);
  });

  test.each(invalidTransitions)('%s → %s is invalid', (from, to) => {
    expect(isValidStatusTransition(from, to)).toBe(false);
  });
});

describe('validateStatusTransition', () => {
  test('throws AppError for invalid transition', () => {
    expect(() => validateStatusTransition('paid', 'draft')).toThrow(AppError);
  });

  test('does not throw for valid transition', () => {
    expect(() => validateStatusTransition('draft', 'sent')).not.toThrow();
  });
});
