'use client';

export default function Topbar() {
  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between">
      <div className="text-sm text-slate-500">
        Overview & Operational Actions
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-700">Admin User</span>
        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
          AU
        </div>
      </div>
    </header>
  );
}