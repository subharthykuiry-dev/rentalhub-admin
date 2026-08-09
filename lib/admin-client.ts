'use client';

/**
 * Browser-side fetch helper for the guarded /api/admin/* endpoints.
 * Attaches the JWT that the login page stores as `admin_token`.
 */
export async function adminFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const payload = await res.json().catch(() => ({}));

  if (res.status === 401) {
    throw new Error('Your admin session has expired. Please sign in again.');
  }
  if (!res.ok) {
    throw new Error((payload as any)?.error || `Request failed (${res.status})`);
  }

  return (payload as any).data as T;
}

export function formatINR(amount: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Consistent chip styling for a payment state across admin screens. */
export function paymentBadge(status?: string, provider?: string) {
  if (status === 'paid') return { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (status === 'failed') return { label: 'Failed', className: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (status === 'refunded' || status === 'partially_refunded')
    return { label: 'Refunded', className: 'bg-violet-50 text-violet-700 border-violet-200' };
  if (provider === 'cod') return { label: 'COD due', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Awaiting payment', className: 'bg-slate-100 text-slate-600 border-slate-200' };
}
