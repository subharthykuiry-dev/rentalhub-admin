'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { adminFetch, formatDate, formatINR, paymentBadge } from '@/lib/admin-client';

const STATUS_FILTERS = [
  'all',
  'pending_payment',
  'confirmed',
  'ready_for_pickup',
  'out_for_delivery',
  'active',
  'overdue',
  'completed',
  'cancelled',
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending_payment: 'bg-slate-100 text-slate-600 border-slate-200',
    confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
    ready_for_pickup: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    out_for_delivery: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    active: 'bg-amber-50 text-amber-700 border-amber-200',
    overdue: 'bg-rose-50 text-rose-700 border-rose-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return map[status] || 'bg-slate-100 text-slate-600 border-slate-200';
}

function OrdersView() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      });
      setRows(await adminFetch<any[]>(`/api/admin/orders?${params}`));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const unpaid = rows.filter((r) => r.paymentStatus !== 'paid').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rental Orders</h1>
          <p className="text-slate-500 text-sm">
            Every rental line from the customer app and walk-in bookings, with its payment state.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unpaid > 0 && (
            <Link
              href="/admin/payments?filter=pending"
              className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-amber-100 transition-colors"
            >
              {unpaid} awaiting payment →
            </Link>
          )}
          <Link
            href="/admin/orders/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm shadow-sm transition-all"
          >
            + Create Walk-In Order
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              statusFilter === filter ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {filter.replace(/_/g, ' ')}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search phone, name, email or order no."
          className="ml-auto text-sm px-3 py-1.5 border border-slate-200 rounded-lg w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[1000px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Order</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Product &amp; Period</th>
              <th className="px-6 py-4">Return by</th>
              <th className="px-6 py-4 text-right">Deposit</th>
              <th className="px-6 py-4">Payment</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-400">Loading rentals…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-400">No rentals match this filter.</td></tr>
            )}
            {!loading && rows.map((row) => {
              const badge = paymentBadge(row.paymentStatus, row.paymentProvider);
              return (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 font-mono text-xs">{row.orderNumber || '—'}</div>
                    <div className="text-xs text-slate-400">{formatDate(row.createdAt)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{row.customerName}</div>
                    <div className="text-xs text-slate-400">{row.customerPhone || row.customerEmail}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-700">{row.productName}</div>
                    <div className="text-xs text-slate-400">
                      {row.rentalDays} day{row.rentalDays === 1 ? '' : 's'} · qty {row.quantity}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800">{formatDate(row.expectedReturnAt)}</div>
                    <div className="capitalize text-slate-400">{row.deliveryMethod}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-emerald-600 tabular-nums">
                    {formatINR(row.securityDeposit)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${badge.className}`}>{badge.label}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${statusBadge(row.status)}`}>
                      {String(row.status).replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/orders/${row.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 px-3 py-1.5 rounded-md hover:bg-blue-50"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="text-slate-400 text-sm">Loading…</div>}>
      <OrdersView />
    </Suspense>
  );
}
