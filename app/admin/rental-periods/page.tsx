'use client';

import { useState } from 'react';

const INITIAL_PERIODS = [
  {
    id: '1',
    name: 'Hourly Rental',
    durationHours: 1,
    periodType: 'hourly',
    lateFeeRate: '$5 / hour',
    gracePeriod: '15 mins',
  },
  {
    id: '2',
    name: 'Daily Rental',
    durationHours: 24,
    periodType: 'daily',
    lateFeeRate: '$25 / day',
    gracePeriod: '60 mins',
  },
  {
    id: '3',
    name: 'Weekly Rental',
    durationHours: 168,
    periodType: 'weekly',
    lateFeeRate: '$100 / week',
    gracePeriod: '120 mins',
  },
];

export default function RentalPeriodsPage() {
  const [periods, setPeriods] = useState(INITIAL_PERIODS);
  const [showModal, setShowModal] = useState(false);
  const [newPeriod, setNewPeriod] = useState({
    name: '',
    durationHours: '',
    periodType: 'daily',
    lateFeeRate: '',
    gracePeriodMinutes: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setPeriods([
      ...periods,
      {
        id: Date.now().toString(),
        name: newPeriod.name,
        durationHours: Number(newPeriod.durationHours),
        periodType: newPeriod.periodType,
        lateFeeRate: `$${newPeriod.lateFeeRate} / ${newPeriod.periodType}`,
        gracePeriod: `${newPeriod.gracePeriodMinutes} mins`,
      },
    ]);
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Rental Periods & Late Fee Rules
          </h1>
          <p className="text-slate-500 text-sm">
            Configure allowed rental durations, grace periods, and late return penalty fees.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm shadow-sm transition-all"
        >
          ➕ Add Rental Period
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Period Name</th>
              <th className="px-6 py-4">Duration (Hours)</th>
              <th className="px-6 py-4">Grace Period</th>
              <th className="px-6 py-4">Late Penalty Rate</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {periods.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-semibold text-slate-800">{p.name}</td>
                <td className="px-6 py-4 text-slate-600">{p.durationHours} hrs</td>
                <td className="px-6 py-4">
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-1 rounded-full font-medium">
                    {p.gracePeriod}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium text-rose-600">{p.lateFeeRate}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-slate-400 hover:text-slate-600 text-xs font-medium">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Add Rental Period & Penalty Rule</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Period Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3-Day Weekend Special"
                  value={newPeriod.name}
                  onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                  <select
                    value={newPeriod.periodType}
                    onChange={(e) => setNewPeriod({ ...newPeriod, periodType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Hours</label>
                  <input
                    type="number"
                    required
                    placeholder="72"
                    value={newPeriod.durationHours}
                    onChange={(e) => setNewPeriod({ ...newPeriod, durationHours: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Grace Period (mins)</label>
                  <input
                    type="number"
                    required
                    placeholder="30"
                    value={newPeriod.gracePeriodMinutes}
                    onChange={(e) => setNewPeriod({ ...newPeriod, gracePeriodMinutes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Late Fee Penalty ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="25"
                    value={newPeriod.lateFeeRate}
                    onChange={(e) => setNewPeriod({ ...newPeriod, lateFeeRate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                >
                  Save Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}