'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch, formatINR } from '@/lib/admin-client';

interface SalesData {
  sales: any;
  trend: Array<{ date: string; booked: number; collected: number; orders: number }>;
  ops: any;
  ledger: any[];
}

/**
 * Revenue panel for the admin dashboard.
 *
 * Money booked and money collected are deliberately separate: since checkout
 * moved to real payment modes, an order is only revenue once Cashfree confirms
 * it or the courier hands over cash.
 */
export default function SalesOverview() {
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<SalesData>('/api/admin/sales')
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse border border-slate-200" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3 rounded-lg">
        Could not load sales data: {error}
      </div>
    );
  }

  if (!data) return null;

  const s = data.sales;
  const peak = Math.max(1, ...data.trend.map((d) => d.booked));

  const cards = [
    {
      label: 'Collected revenue',
      value: formatINR(s.collectedAmount),
      sub: `${s.collectedOrders} paid orders`,
      tint: 'bg-emerald-50 text-emerald-600',
      valueClass: 'text-emerald-600',
    },
    {
      label: 'Outstanding',
      value: formatINR(s.outstandingAmount),
      sub: `${s.outstandingOrders} unpaid orders`,
      tint: 'bg-amber-50 text-amber-600',
      valueClass: s.outstandingAmount > 0 ? 'text-amber-600' : 'text-slate-900',
      href: '/admin/payments?filter=pending',
    },
    {
      label: 'Cash on delivery due',
      value: formatINR(s.codDueAmount),
      sub: `${s.codDueOrders} awaiting handover`,
      tint: 'bg-orange-50 text-orange-600',
      valueClass: 'text-slate-900',
      href: '/admin/payments?filter=cod',
    },
    {
      label: 'Collected this month',
      value: formatINR(s.collectedThisMonth),
      sub: `${s.collectionRate}% collection rate`,
      tint: 'bg-blue-50 text-blue-600',
      valueClass: 'text-slate-900',
    },
  ];

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Sales &amp; collections</h2>
          <p className="text-xs text-slate-500">
            Booked {formatINR(s.grossBooked)} · deposits held {formatINR(data.ops?.depositsHeld)}
          </p>
        </div>
        <Link href="/admin/payments" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
          View invoices →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => {
          const body = (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-full hover:border-slate-300 transition-colors">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{c.label}</p>
              <p className={`text-2xl font-bold mt-2 tabular-nums ${c.valueClass}`}>{c.value}</p>
              <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
            </div>
          );
          return c.href ? <Link key={c.label} href={c.href}>{body}</Link> : <div key={c.label}>{body}</div>;
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Booked vs collected, last 14 days */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Last 14 days</p>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200" /> Booked</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Collected</span>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {data.trend.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col justify-end items-center gap-1 group relative">
                <div className="w-full relative flex items-end justify-center" style={{ height: '100%' }}>
                  <div
                    className="w-full bg-slate-200 rounded-t-sm absolute bottom-0"
                    style={{ height: `${(d.booked / peak) * 100}%` }}
                  />
                  <div
                    className="w-full bg-emerald-500 rounded-t-sm absolute bottom-0"
                    style={{ height: `${(d.collected / peak) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-400">{d.date.slice(8)}</span>
                <div className="hidden group-hover:block absolute bottom-full mb-1 z-10 bg-slate-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap">
                  {d.date}: {formatINR(d.collected)} of {formatINR(d.booked)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment mix + recent ledger */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Payment mix</p>
          <div className="space-y-2 mb-4">
            <MixRow label="Online (Cashfree)" value={s.onlineOrders} total={s.onlineOrders + s.codOrders} className="bg-blue-500" />
            <MixRow label="Cash on delivery" value={s.codOrders} total={s.onlineOrders + s.codOrders} className="bg-amber-500" />
          </div>
          {s.failedOrders > 0 && (
            <p className="text-[11px] text-rose-600 font-medium mb-3">
              {s.failedOrders} failed payment{s.failedOrders === 1 ? '' : 's'} ({formatINR(s.failedAmount)})
            </p>
          )}
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Recent ledger</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {data.ledger.length === 0 && <p className="text-xs text-slate-400">No payments recorded yet.</p>}
            {data.ledger.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 truncate mr-2">
                  {l.customerName} · {String(l.purpose).replace(/_/g, ' ')}
                </span>
                <span className={`font-semibold tabular-nums shrink-0 ${l.status === 'captured' || l.status === 'held' ? 'text-emerald-600' : l.status === 'failed' ? 'text-rose-600' : 'text-slate-400'}`}>
                  {formatINR(l.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MixRow({ label, value, total, className }: { label: string; value: number; total: number; className: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-600 mb-1">
        <span>{label}</span>
        <span className="font-semibold">{value} · {pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${className}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
