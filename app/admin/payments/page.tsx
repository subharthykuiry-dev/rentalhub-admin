'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch, formatDate, formatINR, paymentBadge } from '@/lib/admin-client';

type Filter = 'all' | 'pending' | 'paid' | 'failed' | 'cod' | 'online';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All invoices' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Collected' },
  { value: 'cod', label: 'Cash on delivery' },
  { value: 'online', label: 'Online' },
  { value: 'failed', label: 'Failed' },
];

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ filter, ...(search ? { search } : {}) });
      setInvoices(await adminFetch<any[]>(`/api/admin/invoices?${params}`));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const collect = async (invoice: any) => {
    if (!confirm(`Confirm you have received ${formatINR(invoice.totalAmount)} in cash for ${invoice.orderNumber}?`)) return;

    setBusyId(invoice.id);
    setNotice('');
    try {
      await adminFetch('/api/admin/invoices', {
        method: 'POST',
        body: JSON.stringify({ orderId: invoice.id, action: 'mark_collected' }),
      });
      setNotice(`${invoice.orderNumber} marked as collected.`);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const totalDue = invoices.reduce((sum, i) => sum + (i.amountDue || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payments &amp; Invoices</h1>
          <p className="text-slate-500 text-sm">
            Track what has been collected and what customers still owe. Online payments settle
            automatically; cash on delivery is confirmed here at handover.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Outstanding in view</p>
          <p className="text-xl font-bold text-amber-600 tabular-nums">{formatINR(totalDue)}</p>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-lg">{notice}</div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === f.value ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order no. or customer"
          className="ml-auto text-sm px-3 py-1.5 border border-slate-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[900px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Invoice</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Mode</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4 text-right">Due</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading invoices…</td></tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">No invoices match this filter.</td></tr>
            )}
            {!loading && invoices.map((inv) => {
              const badge = paymentBadge(inv.paymentStatus, inv.paymentProvider);
              return (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 font-mono text-xs">{inv.orderNumber}</div>
                    <div className="text-xs text-slate-400">{formatDate(inv.createdAt)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{inv.customerName}</div>
                    <div className="text-xs text-slate-400">{inv.customerEmail || inv.customerPhone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-semibold text-slate-600 uppercase">
                      {inv.paymentProvider === 'cod' ? 'Cash on delivery' : inv.paymentProvider === 'cashfree' ? 'Online' : inv.paymentProvider || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-800 tabular-nums">{formatINR(inv.totalAmount)}</td>
                  <td className={`px-6 py-4 text-right font-bold tabular-nums ${inv.amountDue > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                    {inv.amountDue > 0 ? formatINR(inv.amountDue) : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${badge.className}`}>{badge.label}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {inv.isCod && inv.paymentStatus !== 'paid' ? (
                      <button
                        onClick={() => collect(inv)}
                        disabled={busyId === inv.id}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs px-3 py-1.5 rounded-md transition-colors"
                      >
                        {busyId === inv.id ? 'Saving…' : 'Mark collected'}
                      </button>
                    ) : (
                      <Link
                        href={`/admin/orders?search=${encodeURIComponent(inv.customerEmail || inv.orderNumber)}`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 px-3 py-1.5 rounded-md hover:bg-blue-50"
                      >
                        View rentals
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Only cash-on-delivery invoices can be settled by hand. Online payments are confirmed by the
        Cashfree gateway so the ledger never claims money the processor did not receive.
      </p>
    </div>
  );
}
