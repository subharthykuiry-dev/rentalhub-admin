'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminFetch, formatDate, formatINR, paymentBadge } from '@/lib/admin-client';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = String(params.id || '');

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [inspection, setInspection] = useState({
    condition: 'good' as 'good' | 'damaged' | 'missing_accessories',
    damageCharge: 0,
    lateFeeOverride: '' as string | number,
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // The list endpoint returns fully joined rows, so the detail view reuses
      // it rather than needing a second shape to keep in sync.
      const rows = await adminFetch<any[]>('/api/admin/orders');
      const match = rows.find((r) => r.id === bookingId);
      if (!match) throw new Error('Rental not found. It may have been deleted.');
      setBooking(match);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setError('');
    setNotice('');
    try {
      await adminFetch('/api/admin/orders', {
        method: 'POST',
        body: JSON.stringify({ action, bookingId, orderId: booking?.orderId, ...extra }),
      });
      setNotice(`Order ${action.replace(/_/g, ' ')} completed.`);
      setShowReturn(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const removeOrder = async () => {
    if (!confirm(`Permanently delete order ${booking.orderNumber}? This removes its bookings, payments and deposit records and cannot be undone.`)) return;
    setBusy('delete');
    try {
      await adminFetch(`/api/admin/orders?orderId=${encodeURIComponent(booking.orderId)}`, { method: 'DELETE' });
      router.push('/admin/orders');
    } catch (err: any) {
      setError(err.message);
      setBusy('');
    }
  };

  if (loading) return <div className="text-slate-400 text-sm">Loading rental…</div>;

  if (error && !booking) {
    return (
      <div className="space-y-4">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3 rounded-lg">{error}</div>
        <Link href="/admin/orders" className="text-blue-600 text-sm font-medium">← Back to orders</Link>
      </div>
    );
  }

  const badge = paymentBadge(booking.paymentStatus, booking.paymentProvider);
  const isPaid = booking.paymentStatus === 'paid';
  const canPickup = ['confirmed', 'ready_for_pickup', 'out_for_delivery'].includes(booking.status);
  const canReturn = ['active', 'overdue'].includes(booking.status);
  const canCancel = !['completed', 'cancelled'].includes(booking.status);
  const canApprove = ['draft', 'pending_payment'].includes(booking.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-xs text-slate-500 hover:text-slate-800">← All rentals</Link>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">{booking.orderNumber || 'Rental'}</h1>
          <p className="text-slate-500 text-sm">
            {booking.customerName} · {booking.customerPhone || booking.customerEmail}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${badge.className}`}>{badge.label}</span>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium border bg-slate-100 text-slate-600 border-slate-200 capitalize">
            {String(booking.status).replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-lg">{notice}</div>}
      {error && <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Rental</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Product" value={booking.productName} />
              <Field label="Quantity" value={String(booking.quantity)} />
              <Field label="Rental start" value={formatDate(booking.rentalStartAt)} />
              <Field label="Return by" value={formatDate(booking.expectedReturnAt)} />
              <Field label="Days" value={String(booking.rentalDays)} />
              <Field label="Fulfilment" value={String(booking.deliveryMethod)} />
            </dl>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Customer</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Name" value={booking.customerName} />
              <Field label="Phone" value={booking.customerPhone || '—'} />
              <Field label="Email" value={booking.customerEmail || '—'} />
              <Field
                label="Delivery address"
                value={
                  booking.deliveryAddressSnapshot
                    ? `${booking.deliveryAddressSnapshot.street}, ${booking.deliveryAddressSnapshot.city}`
                    : 'Store pickup'
                }
              />
            </dl>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Money</h2>
            <dl className="space-y-3 text-sm">
              <Row label="Rental amount" value={formatINR(booking.rentalAmount)} />
              <Row label="Deposit held" value={formatINR(booking.securityDeposit)} accent />
              {booking.lateFees > 0 && <Row label="Late fees" value={formatINR(booking.lateFees)} />}
              {booking.orderTotal != null && (
                <div className="pt-3 border-t border-slate-100">
                  <Row label="Order total" value={formatINR(booking.orderTotal)} bold />
                </div>
              )}
            </dl>
            {!isPaid && (
              <Link
                href="/admin/payments?filter=pending"
                className="mt-4 block text-center text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2 hover:bg-amber-100"
              >
                Payment outstanding — settle in Invoices
              </Link>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-2">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Manage</h2>

            {canApprove && (
              <button onClick={() => act('approve')} disabled={!!busy}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {busy === 'approve' ? 'Approving…' : 'Approve order'}
              </button>
            )}
            {canPickup && (
              <button onClick={() => act('confirm_pickup')} disabled={!!busy}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {busy === 'confirm_pickup' ? 'Saving…' : 'Mark picked up'}
              </button>
            )}
            {canReturn && (
              <button onClick={() => setShowReturn(true)} disabled={!!busy}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                Process return
              </button>
            )}
            {canCancel && (
              <button onClick={() => confirm('Cancel every rental line on this order?') && act('cancel')} disabled={!!busy}
                className="w-full bg-white border border-slate-200 hover:border-rose-300 hover:text-rose-700 text-slate-700 text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel order'}
              </button>
            )}
            <button onClick={removeOrder} disabled={!!busy}
              className="w-full text-rose-600 hover:bg-rose-50 text-sm font-semibold py-2.5 rounded-lg transition-colors">
              {busy === 'delete' ? 'Deleting…' : 'Delete order'}
            </button>
          </div>
        </div>
      </div>

      {showReturn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Return inspection</h3>

            <label className="block text-sm">
              <span className="text-slate-600 font-medium">Condition</span>
              <select
                value={inspection.condition}
                onChange={(e) => setInspection({ ...inspection, condition: e.target.value as any })}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="good">Good</option>
                <option value="damaged">Damaged</option>
                <option value="missing_accessories">Missing accessories</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-slate-600 font-medium">Damage charge (₹)</span>
              <input type="number" min={0} value={inspection.damageCharge}
                onChange={(e) => setInspection({ ...inspection, damageCharge: Number(e.target.value) })}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2" />
            </label>

            <label className="block text-sm">
              <span className="text-slate-600 font-medium">Late fee override (₹)</span>
              <input type="number" min={0} placeholder="Leave blank to accept the calculated fee"
                value={inspection.lateFeeOverride}
                onChange={(e) => setInspection({ ...inspection, lateFeeOverride: e.target.value })}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2" />
              <span className="text-[11px] text-slate-400">Enter 0 to waive it entirely.</span>
            </label>

            <label className="block text-sm">
              <span className="text-slate-600 font-medium">Notes</span>
              <textarea value={inspection.notes} rows={2}
                onChange={(e) => setInspection({ ...inspection, notes: e.target.value })}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2" />
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() =>
                  act('return', {
                    condition: inspection.condition,
                    damageCharge: inspection.damageCharge || undefined,
                    lateFeeOverride: inspection.lateFeeOverride === '' ? undefined : Number(inspection.lateFeeOverride),
                    notes: inspection.notes || undefined,
                  })
                }
                disabled={!!busy}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg"
              >
                {busy === 'return' ? 'Settling…' : 'Settle return'}
              </button>
              <button onClick={() => setShowReturn(false)} className="px-4 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</dt>
      <dd className="text-slate-800 font-medium capitalize mt-0.5">{value}</dd>
    </div>
  );
}

function Row({ label, value, accent, bold }: { label: string; value: string; accent?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold text-slate-900' : accent ? 'font-semibold text-emerald-600' : 'font-semibold text-slate-800'}`}>
        {value}
      </span>
    </div>
  );
}
