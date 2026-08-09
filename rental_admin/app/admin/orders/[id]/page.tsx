'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function OrderDetailsPage() {
  const params = useParams();

  const [order, setOrder] = useState({
    id: params.id || 'ORD-1002',
    customerName: 'Sarah Smith',
    customerPhone: '+1 555-0144',
    productName: 'Electric Mountain Bike XL',
    storeLocation: 'Westside Rental Hub (456 West Ave)',
    scheduledPickup: '2026-08-01 02:00 PM',
    scheduledReturn: '2026-08-08 02:00 PM',
    rentalPrice: 420,
    depositHeld: 100,
    status: 'picked_up', // active rental
  });

  // Modal State for Return & Inspection
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnInspection, setReturnInspection] = useState({
    condition: 'good', // 'good', 'damaged', 'missing_accessories'
    damageCharge: 0,
    lateFeePenalty: 25, // Auto-calculated initial late fee
    notes: '',
  });

  const handleMarkPickedUp = () => {
    setOrder({ ...order, status: 'picked_up' });
    alert('Order marked as Picked Up! Item is now with the customer.');
  };

  const handleSettleReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRefund =
      order.depositHeld -
      returnInspection.damageCharge -
      returnInspection.lateFeePenalty;

    setOrder({ ...order, status: 'returned' });
    setShowReturnModal(false);
    alert(
      `Return finalized!\n\nDeposit Held: $${order.depositHeld}\nDeductions: $${
        returnInspection.damageCharge + returnInspection.lateFeePenalty
      }\n\nFinal Refund Cash Returned: $${Math.max(0, finalRefund)}`
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mb-1"
          >
            ← Back to Orders List
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">
            Order #{order.id}
          </h1>
        </div>

        {/* Order Status Action Buttons */}
        <div className="flex items-center gap-3">
          {order.status === 'confirmed' && (
            <button
              onClick={handleMarkPickedUp}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-lg text-sm shadow-sm"
            >
              📦 Confirm Pickup by Customer
            </button>
          )}

          {order.status === 'picked_up' && (
            <button
              onClick={() => setShowReturnModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-sm shadow-sm flex items-center gap-2"
            >
              🔄 Process Return & Settle Deposit
            </button>
          )}

          {order.status === 'returned' && (
            <span className="bg-emerald-100 text-emerald-800 font-bold px-4 py-2 rounded-lg text-sm border border-emerald-300">
              ✓ Order Completed & Returned
            </span>
          )}
        </div>
      </div>

      {/* Order Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer & Location */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-slate-400">
            Customer & Pickup Location
          </h2>
          <div>
            <div className="text-lg font-bold text-slate-800">{order.customerName}</div>
            <div className="text-sm text-slate-500">{order.customerPhone}</div>
          </div>
          <div className="border-t pt-3">
            <div className="text-xs font-semibold text-slate-500">Shop Branch:</div>
            <div className="text-sm font-medium text-slate-800">🏪 {order.storeLocation}</div>
          </div>
        </div>

        {/* Schedule & Financials */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-slate-400">
            Schedule & Financials
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">Pickup Date</span>
              <span className="font-semibold text-slate-700">{order.scheduledPickup}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Scheduled Return</span>
              <span className="font-semibold text-slate-700">{order.scheduledReturn}</span>
            </div>
          </div>
          <div className="border-t pt-3 flex justify-between text-sm">
            <span>Rental Total: <strong>${order.rentalPrice}</strong></span>
            <span className="text-emerald-700">Security Deposit Held: <strong>${order.depositHeld}</strong></span>
          </div>
        </div>
      </div>

      {/* Return & Inspection Settlement Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="border-b pb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                🔍 Return Product & Deposit Inspection
              </h2>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSettleReturn} className="space-y-4">
              {/* Product Condition */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Returned Item Condition *
                </label>
                <select
                  value={returnInspection.condition}
                  onChange={(e) => setReturnInspection({ ...returnInspection, condition: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="good">Good Condition (No Damages)</option>
                  <option value="damaged">Damaged Product</option>
                  <option value="missing_accessories">Missing Accessories</option>
                </select>
              </div>

              {/* Editable Late Fee Penalty */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Late Return Penalty Fee ($) — <em>Admin Editable/Waivable</em>
                </label>
                <input
                  type="number"
                  min="0"
                  value={returnInspection.lateFeePenalty}
                  onChange={(e) =>
                    setReturnInspection({
                      ...returnInspection,
                      lateFeePenalty: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm font-semibold text-rose-600 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Damage Charges */}
              {returnInspection.condition !== 'good' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Damage / Missing Accessories Deduction ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    value={returnInspection.damageCharge}
                    onChange={(e) =>
                      setReturnInspection({
                        ...returnInspection,
                        damageCharge: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm text-amber-700 font-semibold"
                  />
                </div>
              )}

              {/* Final Settlement Calculation */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Initial Security Deposit Held:</span>
                  <span className="font-semibold">${order.depositHeld}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Late Fee Deducted:</span>
                  <span>-${returnInspection.lateFeePenalty}</span>
                </div>
                {returnInspection.damageCharge > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Damage Fee Deducted:</span>
                    <span>-${returnInspection.damageCharge}</span>
                  </div>
                )}
                <div className="border-t border-slate-300 pt-2 flex justify-between font-bold text-slate-900 text-base">
                  <span>Final Deposit Refund to Customer:</span>
                  <span className="text-emerald-600">
                    $
                    {Math.max(
                      0,
                      order.depositHeld -
                        returnInspection.lateFeePenalty -
                        returnInspection.damageCharge
                    )}
                  </span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  Confirm Return & Refund Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}