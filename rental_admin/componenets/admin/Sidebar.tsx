'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: (
      <path d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z" />
    ),
  },
  {
    label: 'Products',
    href: '/admin/products',
    icon: (
      <>
        <path d="M20.59 13.41L11 3.83A2 2 0 009.59 3.24L3 3.83v6.59a2 2 0 00.59 1.41l9.58 9.58a2 2 0 002.83 0l4.59-4.59a2 2 0 000-2.83z" />
        <circle cx="7.5" cy="7.5" r="1.25" />
      </>
    ),
  },
  {
    label: 'Rental orders',
    href: '/admin/orders',
    icon: (
      <>
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 7v10l9 4 9-4V7" />
        <path d="M12 11v10" />
      </>
    ),
  },
  {
    label: 'Rental periods and late fees',
    href: '/admin/rental-periods',
    icon: (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l3 2" />
        <path d="M9 2h6" />
      </>
    ),
  },
  {
    label: 'Org settings',
    href: '/admin/settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/');
  };

  return (
    <aside className="w-74 shrink-0 h-screen sticky top-0 bg-[#0B1220] text-slate-300 flex flex-col justify-between z-30 border-r border-white/5">
      <div>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/5">
          <div className="w-7 h-7 rounded-md bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9z" />
            </svg>
          </div>
          <span className="text-[14px] font-medium text-white tracking-wide">Rental Hub</span>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-md text-[13.5px] font-medium transition-colors ${
                  isActive
                    ? 'bg-white/[0.06] text-white'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                <span
                  className={`absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full transition-colors ${
                    isActive ? 'bg-blue-400' : 'bg-transparent'
                  }`}
                />
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                >
                  {item.icon}
                </svg>
                <span className="leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / logout */}
      <div className="border-t border-white/5 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13.5px] font-medium text-slate-400 hover:bg-white/[0.04] hover:text-red-300 transition-colors"
        >
          <svg
            width="17" height="17" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Log out
        </button>
        <div className="px-3 pt-3 mt-1 border-t border-white/5 text-[11px] text-slate-500">
          Admin panel v1.0
        </div>
      </div>
    </aside>
  );
}