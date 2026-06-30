/**
 * QuickInvoice API client.
 * - Access token stored in memory only (never localStorage) — SECURITY-12
 * - Refresh token lives in HttpOnly cookie (set by server)
 * - Silent token refresh before expiry
 */

const API_BASE = window.QUICKINVOICE_API_URL || '';

/** In-memory access token — cleared on page refresh (intentional) */
let _accessToken = null;

export function setAccessToken(token) {
  _accessToken = token;
}

export function clearAccessToken() {
  _accessToken = null;
}

export function hasAccessToken() {
  return !!_accessToken;
}

/**
 * Core fetch wrapper. Automatically refreshes token on 401 and retries once.
 */
async function request(path, options = {}, retry = true) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401 && retry) {
    // Attempt silent refresh
    const refreshed = await silentRefresh();
    if (refreshed) {
      return request(path, options, false); // retry once with new token
    }
    // Refresh failed — redirect to login
    redirectToLogin();
    return response;
  }

  return response;
}

async function silentRefresh() {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // send HttpOnly cookie
    });
    if (!res.ok) return false;
    const { accessToken } = await res.json();
    setAccessToken(accessToken);
    return true;
  } catch {
    return false;
  }
}

function redirectToLogin() {
  clearAccessToken();
  window.location.href = '/login.html';
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiRegister(email, password, displayName) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
}

export async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.ok) {
    const { accessToken } = await res.json();
    setAccessToken(accessToken);
  }
  return res;
}

export async function apiLogout() {
  await request('/auth/logout', { method: 'POST', credentials: 'include' });
  clearAccessToken();
  window.location.href = '/login.html';
}

export async function apiRefreshOnLoad() {
  return silentRefresh();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function apiGetDashboard() {
  const res = await request('/dashboard');
  if (!res.ok) throw new Error('Failed to load dashboard');
  return res.json();
}

// ── Clients ───────────────────────────────────────────────────────────────────

export async function apiListClients() {
  const res = await request('/clients');
  if (!res.ok) throw new Error('Failed to load clients');
  return res.json();
}

export async function apiCreateClient(data) {
  const res = await request('/clients', { method: 'POST', body: JSON.stringify(data) });
  return { ok: res.ok, data: await res.json() };
}

export async function apiUpdateClient(id, data) {
  const res = await request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  return { ok: res.ok, data: await res.json() };
}

export async function apiDeleteClient(id) {
  const res = await request(`/clients/${id}`, { method: 'DELETE' });
  return res.ok;
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export async function apiListInvoices(status) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await request(`/invoices${qs}`);
  if (!res.ok) throw new Error('Failed to load invoices');
  return res.json();
}

export async function apiGetInvoice(id) {
  const res = await request(`/invoices/${id}`);
  if (!res.ok) throw new Error('Failed to load invoice');
  return res.json();
}

export async function apiCreateInvoice(data) {
  const res = await request('/invoices', { method: 'POST', body: JSON.stringify(data) });
  return { ok: res.ok, data: await res.json() };
}

export async function apiUpdateInvoice(id, data) {
  const res = await request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  return { ok: res.ok, data: await res.json() };
}

export async function apiDeleteInvoice(id) {
  const res = await request(`/invoices/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function apiDuplicateInvoice(id) {
  const res = await request(`/invoices/${id}/duplicate`, { method: 'POST' });
  return { ok: res.ok, data: await res.json() };
}

export async function apiTransitionStatus(id, status) {
  const res = await request(`/invoices/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return { ok: res.ok, data: await res.json() };
}

export async function apiDownloadPDF(id, invoiceNumber) {
  const res = await request(`/invoices/${id}/pdf`);
  if (!res.ok) throw new Error('Failed to generate PDF');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoiceNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
