/**
 * Property-based tests for dashboard-calculator.ts — NFR-06.2.
 */
import * as fc from 'fast-check';
import {
  computeOutstanding,
  computeOverdue,
  computeRevenueThisMonth,
  computeRevenueThisYear,
  computeTopClients,
  computeAvgPaymentTime,
  computeDashboard,
} from '../../../src/dashboard/services/dashboard-calculator';
import { Invoice, InvoiceStatus } from '../../../src/shared/types/index';

const statusArb = fc.constantFrom<InvoiceStatus>('draft', 'sent', 'viewed', 'paid');

const invoiceArb = fc.record<Invoice>({
  invoiceId: fc.uuid(),
  userId: fc.uuid(),
  clientId: fc.uuid(),
  invoiceNumber: fc.string({ minLength: 1 }),
  status: statusArb,
  issueDate: fc.constant('2026-01-01'),
  dueDate: fc.oneof(
    fc.constant('2026-01-31'),
    fc.constant('2025-12-31'), // overdue
  ),
  currency: fc.constant('AUD'),
  lineItems: fc.constant([]),
  subtotal: fc.integer({ min: 0, max: 1_000_000_00 }),
  taxTotal: fc.integer({ min: 0, max: 100_000_00 }),
  grandTotal: fc.integer({ min: 0, max: 1_100_000_00 }),
  notes: fc.constant(null),
  createdAt: fc.constant('2026-01-01T00:00:00Z'),
  updatedAt: fc.constant('2026-01-01T00:00:00Z'),
  sentAt: fc.oneof(fc.constant(null), fc.constant('2026-01-05T00:00:00Z')),
  viewedAt: fc.constant(null),
  paidAt: fc.oneof(fc.constant(null), fc.constant('2026-06-15T00:00:00Z')),
  deletedAt: fc.constant(null),
});

const invoicesArb = fc.array(invoiceArb, { minLength: 0, maxLength: 50 });

// ─── computeOutstanding ──────────────────────────────────────────────────────

describe('computeOutstanding', () => {
  test('PBT: always non-negative', () => {
    fc.assert(
      fc.property(invoicesArb, (invoices) => {
        expect(computeOutstanding(invoices)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  test('PBT: never exceeds sum of all invoice totals', () => {
    fc.assert(
      fc.property(invoicesArb, (invoices) => {
        const total = invoices.reduce((s, i) => s + i.grandTotal, 0);
        expect(computeOutstanding(invoices)).toBeLessThanOrEqual(total);
      }),
    );
  });

  test('only counts sent and viewed', () => {
    const invoices: Invoice[] = [
      { ...invoiceArb.sample()[0]!, status: 'sent', grandTotal: 1000 },
      { ...invoiceArb.sample()[0]!, status: 'viewed', grandTotal: 500 },
      { ...invoiceArb.sample()[0]!, status: 'paid', grandTotal: 200 },
      { ...invoiceArb.sample()[0]!, status: 'draft', grandTotal: 300 },
    ] as unknown as Invoice[];
    // ts-ignore hack for test — use actual values
    const result = computeOutstanding([
      { grandTotal: 1000, status: 'sent' } as Invoice,
      { grandTotal: 500, status: 'viewed' } as Invoice,
      { grandTotal: 200, status: 'paid' } as Invoice,
      { grandTotal: 300, status: 'draft' } as Invoice,
    ]);
    expect(result).toBe(1500);
  });
});

// ─── computeOverdue ──────────────────────────────────────────────────────────

describe('computeOverdue', () => {
  test('PBT: overdue is always <= outstanding', () => {
    fc.assert(
      fc.property(invoicesArb, (invoices) => {
        const today = new Date('2026-06-30');
        const overdue = computeOverdue(invoices, today);
        const outstanding = computeOutstanding(invoices);
        expect(overdue).toBeLessThanOrEqual(outstanding);
      }),
    );
  });

  test('PBT: always non-negative', () => {
    fc.assert(
      fc.property(invoicesArb, (invoices) => {
        expect(computeOverdue(invoices, new Date('2026-06-30'))).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

// ─── computeRevenueThisMonth / Year ──────────────────────────────────────────

describe('computeRevenueThisMonth vs computeRevenueThisYear', () => {
  test('PBT: monthly revenue always <= yearly revenue', () => {
    fc.assert(
      fc.property(invoicesArb, (invoices) => {
        const now = new Date('2026-06-30');
        const monthly = computeRevenueThisMonth(invoices, now);
        const yearly = computeRevenueThisYear(invoices, now);
        expect(monthly).toBeLessThanOrEqual(yearly);
      }),
    );
  });
});

// ─── computeTopClients ───────────────────────────────────────────────────────

describe('computeTopClients', () => {
  test('PBT: result count never exceeds unique client count', () => {
    fc.assert(
      fc.property(invoicesArb, fc.integer({ min: 1, max: 10 }), (invoices, n) => {
        const uniqueClients = new Set(
          invoices.filter((i) => i.status === 'paid').map((i) => i.clientId),
        ).size;
        const topClients = computeTopClients(invoices, n);
        expect(topClients.length).toBeLessThanOrEqual(uniqueClients);
        expect(topClients.length).toBeLessThanOrEqual(n);
      }),
    );
  });

  test('PBT: all revenues are positive', () => {
    fc.assert(
      fc.property(invoicesArb, (invoices) => {
        computeTopClients(invoices, 5).forEach((c) => {
          expect(c.totalRevenue).toBeGreaterThan(0);
        });
      }),
    );
  });
});

// ─── computeAvgPaymentTime ───────────────────────────────────────────────────

describe('computeAvgPaymentTime', () => {
  test('returns null when no paid invoices', () => {
    expect(computeAvgPaymentTime([])).toBeNull();
    expect(
      computeAvgPaymentTime([{ status: 'draft' } as Invoice]),
    ).toBeNull();
  });

  test('returns non-negative number for paid invoices', () => {
    const invoices: Partial<Invoice>[] = [
      {
        status: 'paid',
        sentAt: '2026-06-01T00:00:00Z',
        paidAt: '2026-06-10T00:00:00Z',
      },
    ];
    const result = computeAvgPaymentTime(invoices as Invoice[]);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

// ─── computeDashboard (smoke) ────────────────────────────────────────────────

describe('computeDashboard', () => {
  test('PBT: returns all required fields', () => {
    fc.assert(
      fc.property(invoicesArb, (invoices) => {
        const result = computeDashboard(invoices, new Date('2026-06-30'));
        expect(result).toHaveProperty('outstandingTotal');
        expect(result).toHaveProperty('overdueTotal');
        expect(result).toHaveProperty('revenueThisMonth');
        expect(result).toHaveProperty('revenueThisYear');
        expect(result).toHaveProperty('avgPaymentTimeDays');
        expect(result).toHaveProperty('recentActivity');
        expect(result).toHaveProperty('topClients');
      }),
    );
  });
});
