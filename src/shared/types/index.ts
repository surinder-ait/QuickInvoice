// ─── User ───────────────────────────────────────────────────────────────────

export interface User {
  userId: string;
  email: string;
  passwordHash: string;
  displayName: string;
  invoicePrefix: string;   // e.g. "INV", validated: /^[A-Z0-9]{1,10}$/i
  emailVerified: boolean;
  tokenVersion: number;    // incremented on mass revocation
  createdAt: string;       // ISO 8601
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  invoicePrefix: string;
  createdAt: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  invoicePrefix?: string;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  /** Sent as HttpOnly cookie, not in response body */
  refreshToken?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export interface Client {
  clientId: string;
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateClientRequest {
  name: string;
  email: string;
}

export interface UpdateClientRequest {
  name?: string;
  email?: string;
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid';

export interface LineItem {
  description: string;
  quantity: number;      // positive integer or decimal, stored as number
  unitPrice: number;     // integer cents (AUD)
  taxRate: number;       // percentage, e.g. 10 for 10%
}

export interface Invoice {
  invoiceId: string;
  userId: string;
  clientId: string;
  invoiceNumber: string;  // e.g. "INV-007"
  status: InvoiceStatus;
  issueDate: string;      // ISO date string, e.g. "2026-06-30"
  dueDate: string;
  currency: 'AUD';
  lineItems: LineItem[];
  subtotal: number;       // integer cents
  taxTotal: number;       // integer cents
  grandTotal: number;     // integer cents
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  deletedAt: string | null;
}

export interface CreateInvoiceRequest {
  clientId: string;
  issueDate: string;
  dueDate: string;
  lineItems: LineItem[];
  notes?: string;
}

export interface UpdateInvoiceRequest {
  clientId?: string;
  issueDate?: string;
  dueDate?: string;
  lineItems?: LineItem[];
  notes?: string;
}

export interface StatusTransitionRequest {
  status: InvoiceStatus;
}

export interface InvoiceTotals {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface RecentActivityItem {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  status: InvoiceStatus;
  grandTotal: number;
  updatedAt: string;
}

export interface TopClient {
  clientId: string;
  totalRevenue: number;   // integer cents
}

export interface DashboardSummary {
  outstandingTotal: number;    // cents
  overdueTotal: number;        // cents
  revenueThisMonth: number;    // cents
  revenueThisYear: number;     // cents
  avgPaymentTimeDays: number | null;
  recentActivity: RecentActivityItem[];
  topClients: TopClient[];
}
