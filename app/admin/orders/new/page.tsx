'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateOrderPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    productId: '1',
    rentalPeriod: '24', // 24 hours
    pickupDate: new Date().toISOString().slice(0, 16),
    returnDate: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    rentalPrice: 45,
    depositAmount: 150,
  });

  const handleCalculateTotal = () => {
    return Number(formData.rentalPrice) + Number(formData.depositAmount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating Walk-In Order:', formData);
    alert('Walk-In Rental Order created & payment confirmed! (Mock Action)');
    router.push('/admin/orders');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mb-1"
          >
            ← Back to Orders List
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">
            Create Walk-In / In-Store Order
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Customer Details */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
            👤 1. Customer Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="John Doe"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="+1 555-0192"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="john@example.com"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Product & Duration Selection */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
            🏷️ 2. Select Product & Rental Duration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Select Rental Product *
              </label>
              <select
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">DSLR Camera Canon EOS R6 (Downtown Hub)</option>
                <option value="2">Electric Mountain Bike XL (Westside Hub)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Rental Period Rule
              </label>
              <select
                value={formData.rentalPeriod}
                onChange={(e) => setFormData({ ...formData, rentalPeriod: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">Hourly (1 hr)</option>
                <option value="24">Daily (24 hrs)</option>
                <option value="168">Weekly (7 days)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Scheduled Pickup Time
              </label>
              <input
                type="datetime-local"
                value={formData.pickupDate}
                onChange={(e) => setFormData({ ...formData, pickupDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Scheduled Return Time
              </label>
              <input
                type="datetime-local"
                value={formData.returnDate}
                onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Editable Pricing & Security Deposit Summary */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
            💳 3. Payment & Security Deposit Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Rental Charge ($)
              </label>
              <input
                type="number"
                value={formData.rentalPrice}
                onChange={(e) => setFormData({ ...formData, rentalPrice: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Security Deposit Held ($)
              </label>
              <input
                type="number"
                value={formData.depositAmount}
                onChange={(e) => setFormData({ ...formData, depositAmount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between text-slate-800 font-bold text-base mt-2">
            <span>Total Collected In-Store:</span>
            <span className="text-xl text-blue-600">${handleCalculateTotal()}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/orders"
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition-all"
          >
            Confirm Order & Collect Payment
          </button>
        </div>
      </form>
    </div>
  );
}