'use client';

import { useState } from 'react';
import Link from 'next/link';

const MOCK_ORDERS = [
  {
    id: 'ORD-1001',
    customerName: 'John Doe',
    customerPhone: '+1 555-0192',
    productName: 'DSLR Camera Canon EOS R6',
    rentalPeriod: 'Daily (24 hrs)',
    pickupTime: '2026-08-08 10:00 AM',
    returnTime: '2026-08-09 10:00 AM',
    totalRent: 45,
    depositHeld: 150,
    status: 'picked_up', // options: 'draft', 'confirmed', 'picked_up', 'returned', 'overdue'
  },
  {
    id: 'ORD-1002',
    customerName: 'Sarah Smith',
    customerPhone: '+1 555-0144',
    productName: 'Electric Mountain Bike XL',
    rentalPeriod: 'Weekly (168 hrs)',
    pickupTime: '2026-08-01 02:00 PM',
    returnTime: '2026-08-08 02:00 PM',
    totalRent: 420,
    depositHeld: 100,
    status: 'overdue',
  },
  {
    id: 'ORD-1003',
    customerName: 'Alex Johnson',
    customerPhone: '+1 555-0881',
    productName: 'DJI Mavic Drone Pro',
    rentalPeriod: 'Daily (24 hrs)',
    pickupTime: '2026-08-10 09:00 AM',
    returnTime: '2026-08-11 09:00 AM',
    totalRent: 80,
    depositHeld: 200,
    status: 'confirmed',
  },
];

export default function OrdersPage() {
  const [orders] = useState(MOCK_ORDERS);
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredOrders = orders.filter((order) => {
    if (statusFilter === 'all') return true;
    return order.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-1 rounded-full font-medium">Confirmed</span>;
      case 'picked_up':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-1 rounded-full font-medium">Picked Up (Active)</span>;
      case 'returned':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-medium">Returned</span>;
      case 'overdue':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2.5 py-1 rounded-full font-medium animate-pulse">⚠️ Overdue</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-medium">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rental Orders</h1>
          <p className="text-slate-500 text-sm">
            Manage in-store walk-in bookings, active rentals, pickups, and returns.
          </p>
        </div>
        <Link
          href="/admin/orders/new"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm shadow-sm transition-all"
        >
          <span>➕</span> Create Walk-In Order
        </Link>
      </div>

      {/* Status Filters */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 overflow-x-auto">
        {['all', 'confirmed', 'picked_up', 'overdue', 'returned'].map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              statusFilter === filter
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {filter.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Order ID</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Product & Period</th>
              <th className="px-6 py-4">Return Schedule</th>
              <th className="px-6 py-4">Deposit Held</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredOrders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800">{order.id}</td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-800">{order.customerName}</div>
                  <div className="text-xs text-slate-400">{order.customerPhone}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-700">{order.productName}</div>
                  <div className="text-xs text-slate-400">{order.rentalPeriod}</div>
                </td>
                <td className="px-6 py-4 text-xs text-slate-600">
                  <div>Return By:</div>
                  <div className="font-semibold text-slate-800">{order.returnTime}</div>
                </td>
                <td className="px-6 py-4 font-semibold text-emerald-600">
                  ${order.depositHeld}
                </td>
                <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 px-3 py-1.5 rounded-md hover:bg-blue-50"
                  >
                    Manage Order
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