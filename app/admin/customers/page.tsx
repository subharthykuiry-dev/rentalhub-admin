'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch, formatDate, formatINR } from '@/lib/admin-client';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams(search ? { search } : {});
      setCustomers(await adminFetch<any[]>(`/api/admin/customers?${params}`));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totals = customers.reduce(
    (acc, c) => ({
      revenue: acc.revenue + (c.lifetimeValue || 0),
      dues: acc.dues + (c.outstanding || 0),
    }),
    { revenue: 0, dues: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
          <p className="text-slate-500 text-sm">
            Lifetime value, outstanding dues and rental history for everyone who has ordered.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Collected</p>
            <p className="text-xl font-bold text-emerald-600 tabular-nums">{formatINR(totals.revenue)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Owed</p>
            <p className="text-xl font-bold text-amber-600 tabular-nums">{formatINR(totals.dues)}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="text-sm px-3 py-2 border border-slate-200 rounded-lg w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[880px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4 text-center">Orders</th>
              <th className="px-6 py-4 text-center">Payment mix</th>
              <th className="px-6 py-4 text-right">Lifetime value</th>
              <th className="px-6 py-4 text-right">Outstanding</th>
              <th className="px-6 py-4">Last order</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading customers…</td></tr>
            )}
            {!loading && customers.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">No customers yet.</td></tr>
            )}
            {!loading && customers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-800">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.email}</div>
                  {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="font-semibold text-slate-800">{c.orders}</div>
                  {c.pendingOrders > 0 && (
                    <div className="text-[11px] text-amber-600 font-medium">{c.pendingOrders} unpaid</div>
                  )}
                </td>
                <td className="px-6 py-4 text-center text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{c.onlineOrders}</span> online
                  <span className="text-slate-300"> · </span>
                  <span className="font-semibold text-slate-700">{c.codOrders}</span> COD
                </td>
                <td className="px-6 py-4 text-right font-bold text-emerald-600 tabular-nums">{formatINR(c.lifetimeValue)}</td>
                <td className={`px-6 py-4 text-right font-bold tabular-nums ${c.outstanding > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                  {c.outstanding > 0 ? formatINR(c.outstanding) : '—'}
                </td>
                <td className="px-6 py-4 text-xs text-slate-600">{formatDate(c.lastOrderAt)}</td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/admin/payments?search=${encodeURIComponent(c.email || c.name)}`}
                    className="text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 px-3 py-1.5 rounded-md hover:bg-blue-50"
                  >
                    Invoices
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
