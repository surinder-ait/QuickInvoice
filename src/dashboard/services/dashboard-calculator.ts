/**
 * Pure dashboard aggregation functions — property-based testable (NFR-06.2).
 * All monetary values in integer cents.
 */
import { Invoice, DashboardSummary, RecentActivityItem, TopClient } from '../../shared/types/index';

export function computeOutstanding(invoices: Invoice[]): number {
  return invoices
    .filter((i) => i.status === 'sent' || i.status === 'viewed')
    .reduce((sum, i) => sum + i.grandTotal, 0);
}

export function computeOverdue(invoices: Invoice[], today: Date): number {
  const todayStr = today.toISOString().split('T')[0]!;
  return invoices
    .filter(
      (i) =>
        (i.status === 'sent' || i.status === 'viewed') &&
        i.dueDate < todayStr,
    )
    .reduce((sum, i) => sum + i.grandTotal, 0);
}

export function computeRevenueThisMonth(invoices: Invoice[], now: Date): number {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `${year}-${month}`;
  return invoices
    .filter((i) => i.status === 'paid' && i.paidAt?.startsWith(prefix))
    .reduce((sum, i) => sum + i.grandTotal, 0);
}

export function computeRevenueThisYear(invoices: Invoice[], now: Date): number {
  const year = String(now.getFullYear());
  return invoices
    .filter((i) => i.status === 'paid' && i.paidAt?.startsWith(year))
    .reduce((sum, i) => sum + i.grandTotal, 0);
}

export function computeRecentActivity(
  invoices: Invoice[],
  n: number,
): RecentActivityItem[] {
  return [...invoices]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, n)
    .map((i) => ({
      invoiceId: i.invoiceId,
      invoiceNumber: i.invoiceNumber,
      clientId: i.clientId,
      status: i.status,
      grandTotal: i.grandTotal,
      updatedAt: i.updatedAt,
    }));
}

export function computeTopClients(invoices: Invoice[], n: number): TopClient[] {
  const revenue = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status === 'paid') {
      revenue.set(inv.clientId, (revenue.get(inv.clientId) ?? 0) + inv.grandTotal);
    }
  }
  return [...revenue.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([clientId, totalRevenue]) => ({ clientId, totalRevenue }));
}

export function computeAvgPaymentTime(invoices: Invoice[]): number | null {
  const paid = invoices.filter(
    (i) => i.status === 'paid' && i.sentAt && i.paidAt,
  );
  if (paid.length === 0) return null;
  const totalDays = paid.reduce((sum, i) => {
    const sent = new Date(i.sentAt!).getTime();
    const paidTime = new Date(i.paidAt!).getTime();
    return sum + (paidTime - sent) / (1000 * 60 * 60 * 24);
  }, 0);
  return Math.round(totalDays / paid.length);
}

export function computeDashboard(invoices: Invoice[], now: Date): DashboardSummary {
  return {
    outstandingTotal: computeOutstanding(invoices),
    overdueTotal: computeOverdue(invoices, now),
    revenueThisMonth: computeRevenueThisMonth(invoices, now),
    revenueThisYear: computeRevenueThisYear(invoices, now),
    avgPaymentTimeDays: computeAvgPaymentTime(invoices),
    recentActivity: computeRecentActivity(invoices, 10),
    topClients: computeTopClients(invoices, 5),
  };
}
