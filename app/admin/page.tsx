'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface IProduct {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  storeLocation: {
    shopName: string;
    address: string;
    city: string;
    zipCode?: string;
    contactPhone?: string;
  };
  deposit: {
    type: 'fixed' | 'percentage';
    value: number;
  };
  totalQuantity: number;
  availableQuantity: number;
  attributes?: {
    brand?: string;
    manufacturer?: string;
    color?: string;
    size?: string;
  };
  createdAt: string;
}

function Icon({ path, className = '' }: { path: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {path}
    </svg>
  );
}

export default function AdminDashboardPage() {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // NOTE: filters by an email read out of localStorage, which the client
  // fully controls — anyone can edit that value in devtools and pull
  // another admin's inventory. The server endpoint needs to derive the
  // admin from the auth token/session, not trust this query param.
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      let adminEmail = '';
      const storedAdmin = localStorage.getItem('admin');
      if (storedAdmin) {
        if (storedAdmin.startsWith('{')) {
          const adminObj = JSON.parse(storedAdmin);
          adminEmail = adminObj?.email || '';
        } else if (storedAdmin.includes('@')) {
          adminEmail = storedAdmin;
        }
      }

      const url = adminEmail
        ? `/api/products?publishedBy=${encodeURIComponent(adminEmail)}`
        : '/api/products';

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setProducts(data.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.isActive).length;
  const totalQuantity = products.reduce((sum, p) => sum + (p.totalQuantity || 0), 0);
  const availableQuantity = products.reduce((sum, p) => sum + (p.availableQuantity || 0), 0);
  const rentedQuantity = Math.max(0, totalQuantity - availableQuantity);
  const utilizationRate = totalQuantity > 0 ? Math.round((rentedQuantity / totalQuantity) * 100) : 0;

  const outOfStockProducts = products.filter((p) => p.availableQuantity === 0);
  const lowStockProducts = products.filter((p) => p.availableQuantity === 1 && p.totalQuantity > 1);

  const storeMap: Record<string, { count: number; city: string }> = {};
  products.forEach((p) => {
    const shop = p.storeLocation?.shopName || 'Unassigned store';
    const city = p.storeLocation?.city || 'Unknown city';
    if (!storeMap[shop]) storeMap[shop] = { count: 0, city };
    storeMap[shop].count += 1;
  });

  const recentProducts = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const kpis = [
    {
      label: 'Total catalog',
      value: totalProducts,
      sub: `${activeProducts} active`,
      icon: <path d="M20.59 13.41L11 3.83A2 2 0 009.59 3.24L3 3.83v6.59a2 2 0 00.59 1.41l9.58 9.58a2 2 0 002.83 0l4.59-4.59a2 2 0 000-2.83zM7.5 8.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />,
      tint: 'bg-blue-50',
      fg: 'text-blue-600',
      ring: 'ring-blue-100',
      value_fg: 'text-slate-900',
    },
    {
      label: 'Fleet utilization',
      value: `${utilizationRate}%`,
      sub: `${rentedQuantity} rented out`,
      icon: (
        <>
          <path d="M3 3v18h18" />
          <path d="M18 9l-5 5-4-4-4 4" />
        </>
      ),
      tint: 'bg-purple-50',
      fg: 'text-purple-600',
      ring: 'ring-purple-100',
      value_fg: 'text-purple-700',
    },
    {
      label: 'Total fleet units',
      value: totalQuantity,
      sub: 'across all locations',
      icon: (
        <>
          <path d="M3 7l9-4 9 4-9 4-9-4z" />
          <path d="M3 7v10l9 4 9-4V7" />
          <path d="M12 11v10" />
        </>
      ),
      tint: 'bg-amber-50',
      fg: 'text-amber-600',
      ring: 'ring-amber-100',
      value_fg: 'text-slate-900',
    },
    {
      label: 'Available now',
      value: availableQuantity,
      sub: 'ready for pickup',
      icon: (
        <>
          <path d="M21 12a9 9 0 11-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </>
      ),
      tint: 'bg-emerald-50',
      fg: 'text-emerald-600',
      ring: 'ring-emerald-100',
      value_fg: 'text-emerald-700',
    },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900 tracking-tight">Operations dashboard</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Overview of inventory, store allocation, and fleet utilization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-md shadow-sm hover:shadow-md hover:bg-slate-50 hover:border-slate-300 transition-all"
            aria-label="Refresh data"
          >
            <Icon path={<><path d="M21 12a9 9 0 11-2.64-6.36" /><path d="M21 3v6h-6" /></>} className="w-4 h-4" />
          </button>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3.5 h-9 rounded-md text-[13px] shadow-md hover:shadow-lg transition-all"
          >
            <Icon path={<path d="M12 5v14M5 12h14" />} className="w-4 h-4" />
            Add product
          </Link>
        </div>
      </div>

      {/* ================= KPI CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="relative overflow-hidden bg-white p-4 rounded-xl border border-slate-200 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${k.tint} opacity-60`} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{k.label}</div>
                <div className={`text-[26px] font-semibold leading-tight mt-1.5 ${k.value_fg}`}>{k.value}</div>
                <div className="text-[11.5px] text-slate-400 mt-0.5">{k.sub}</div>
              </div>
              <div className={`w-9 h-9 rounded-lg ${k.tint} ${k.fg} ring-1 ${k.ring} shadow-sm flex items-center justify-center shrink-0`}>
                <Icon path={k.icon} className="w-4.5 h-4.5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ================= MIDDLE ANALYTICS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Utilization + alerts */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-md space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-[14.5px] font-semibold text-slate-900">Inventory status</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">Operational status of physical stock</p>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Not yet loaded'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[12px] font-medium">
              <span className="text-slate-600">Rented vs available stock</span>
              <span className="text-slate-800">{rentedQuantity} / {totalQuantity} units rented</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              <div style={{ width: `${utilizationRate}%` }} className="bg-purple-500 h-full transition-all duration-500" />
              <div style={{ width: `${100 - utilizationRate}%` }} className="bg-emerald-500 h-full transition-all duration-500" />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Rented ({rentedQuantity})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Available ({availableQuantity})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg border border-red-100 bg-red-50/60 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-red-700 flex items-center gap-1.5">
                  <Icon path={<><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" /></>} className="w-3.5 h-3.5" />
                  Out of stock
                </span>
                <span className="text-[11px] font-semibold text-red-800 bg-red-100 px-1.5 py-0.5 rounded shadow-sm">
                  {outOfStockProducts.length}
                </span>
              </div>
              {outOfStockProducts.length === 0 ? (
                <p className="text-[11.5px] text-red-600/80">All items have available stock.</p>
              ) : (
                <ul className="text-[11.5px] text-slate-700 space-y-1">
                  {outOfStockProducts.slice(0, 3).map((p) => (
                    <li key={p._id} className="truncate font-medium flex items-center justify-between">
                      <span className="truncate">{p.name}</span>
                      <Link href={`/admin/products/${p._id}`} className="text-red-600 hover:underline shrink-0 ml-2">
                        Edit
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-3.5 rounded-lg border border-amber-100 bg-amber-50/60 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-amber-700 flex items-center gap-1.5">
                  <Icon path={<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>} className="w-3.5 h-3.5" />
                  Low availability
                </span>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded shadow-sm">
                  {lowStockProducts.length}
                </span>
              </div>
              {lowStockProducts.length === 0 ? (
                <p className="text-[11.5px] text-amber-600/80">No low stock warnings.</p>
              ) : (
                <ul className="text-[11.5px] text-slate-700 space-y-1">
                  {lowStockProducts.slice(0, 3).map((p) => (
                    <li key={p._id} className="truncate font-medium flex items-center justify-between">
                      <span className="truncate">{p.name}</span>
                      <Link href={`/admin/products/${p._id}`} className="text-amber-700 hover:underline shrink-0 ml-2">
                        Edit
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Store locations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-md space-y-3.5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-[14.5px] font-semibold text-slate-900">Pickup locations</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Products grouped by shop</p>
          </div>

          {Object.keys(storeMap).length === 0 ? (
            <p className="text-[12px] text-slate-400 py-8 text-center">No stores configured yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(storeMap).map(([shopName, info]) => (
                <div
                  key={shopName}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 shadow-sm text-[12px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon path={<><path d="M3 9l1-5h16l1 5" /><path d="M4 9v10a1 1 0 001 1h14a1 1 0 001-1V9" /><path d="M9 21v-6h6v6" /></>} className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">{shopName}</div>
                      <div className="text-slate-400 text-[11px]">{info.city}</div>
                    </div>
                  </div>
                  <span className="font-medium text-blue-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm shrink-0 ml-2">
                    {info.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= RECENT PRODUCTS ================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3.5 border-b border-slate-100">
          <div>
            <h2 className="text-[14.5px] font-semibold text-slate-900">Recently added</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Latest additions to your catalog</p>
          </div>
          <Link href="/admin/products" className="text-[12px] text-blue-600 font-medium hover:underline">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-[12.5px]">Loading recent items…</div>
        ) : recentProducts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-[12.5px]">No products in catalog yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 text-slate-500 text-[10.5px] font-medium uppercase tracking-wide border-b border-slate-100">
                <tr>
                  <th className="px-5 py-2.5">Product</th>
                  <th className="px-5 py-2.5">Store pickup</th>
                  <th className="px-5 py-2.5">Deposit</th>
                  <th className="px-5 py-2.5">Stock</th>
                  <th className="px-5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentProducts.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-slate-50 overflow-hidden shrink-0 border border-slate-100 shadow-sm">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Icon path={<rect x="3" y="3" width="18" height="14" rx="2" />} className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-400">{p.attributes?.brand || 'No brand'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-700">{p.storeLocation?.shopName}</div>
                      <div className="text-slate-400 text-[11px]">{p.storeLocation?.city}</div>
                    </td>
                    <td className="px-5 py-3 font-semibold text-emerald-600">
                      {p.deposit?.type === 'percentage' ? `${p.deposit?.value}% rent` : `$${p.deposit?.value} fixed`}
                    </td>
                    <td className="px-5 py-3 font-medium">
                      <span className="text-blue-600">{p.availableQuantity}</span>
                      <span className="text-slate-400"> / {p.totalQuantity} available</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/products/${p._id}`}
                        className="text-slate-700 hover:text-slate-900 font-medium border border-slate-200 px-2.5 py-1 rounded shadow-sm hover:shadow-md hover:bg-slate-50 transition-all"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}