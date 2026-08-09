'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-client';

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

export default function ProductsPage() {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  const [error, setError] = useState('');

  // Scoped to the signed-in admin server-side, so this lists only products
  // this admin published rather than the whole marketplace catalogue.
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');
      setProducts(await adminFetch<IProduct[]>('/api/admin/products'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"?`)) return;

    try {
      await adminFetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete product');
    }
  };

  const filteredProducts = products.filter((p) => {
    const query = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.storeLocation?.shopName?.toLowerCase().includes(query) ||
      p.storeLocation?.city?.toLowerCase().includes(query) ||
      p.attributes?.brand?.toLowerCase().includes(query)
    );
  });

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.isActive).length;
  const totalStockUnits = products.reduce((sum, p) => sum + (p.totalQuantity || 0), 0);
  const availableStockUnits = products.reduce((sum, p) => sum + (p.availableQuantity || 0), 0);

  const stats = [
    {
      label: 'Total products',
      value: totalProducts,
      icon: <path d="M20.59 13.41L11 3.83A2 2 0 009.59 3.24L3 3.83v6.59a2 2 0 00.59 1.41l9.58 9.58a2 2 0 002.83 0l4.59-4.59a2 2 0 000-2.83zM7.5 8.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />,
      ring: 'ring-blue-100',
      tint: 'bg-blue-50',
      fg: 'text-blue-600',
      value_fg: 'text-slate-900',
    },
    {
      label: 'Active listings',
      value: activeProducts,
      icon: <path d="M20 6L9 17l-5-5" />,
      ring: 'ring-emerald-100',
      tint: 'bg-emerald-50',
      fg: 'text-emerald-600',
      value_fg: 'text-emerald-700',
    },
    {
      label: 'Total inventory',
      value: `${totalStockUnits}`,
      suffix: 'units',
      icon: (
        <>
          <path d="M3 7l9-4 9 4-9 4-9-4z" />
          <path d="M3 7v10l9 4 9-4V7" />
          <path d="M12 11v10" />
        </>
      ),
      ring: 'ring-purple-100',
      tint: 'bg-purple-50',
      fg: 'text-purple-600',
      value_fg: 'text-slate-900',
    },
    {
      label: 'Available now',
      value: `${availableStockUnits}`,
      suffix: 'units',
      icon: (
        <>
          <path d="M21 12a9 9 0 11-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </>
      ),
      ring: 'ring-amber-100',
      tint: 'bg-amber-50',
      fg: 'text-amber-600',
      value_fg: 'text-slate-900',
    },
  ];

  return (
    <div className="space-y-6 pb-16 ">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900 tracking-tight">Rental catalog</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Products you have published — inventory, pickup locations and deposit rules.
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3.5 h-9 rounded-md text-[13px] transition-colors"
        >
          <Icon path={<path d="M12 5v14M5 12h14" />} className="w-4 h-4" />
          Add product
        </Link>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* ================= STATS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`relative overflow-hidden bg-white p-4 rounded-xl border border-gray-200 shadow-lg  hover:scale-102  transition-all duration-300`}
          >
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${s.tint} opacity-60`} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{s.label}</div>
                <div className={`text-[26px] font-semibold leading-tight mt-1.5 ${s.value_fg}`}>
                  {s.value}
                  {s.suffix && <span className="text-[13px] font-medium text-slate-400 ml-1">{s.suffix}</span>}
                </div>
              </div>
              <div className={`w-9 h-9 rounded-lg ${s.tint} ${s.fg} ring-1 ${s.ring} flex items-center justify-center shrink-0`}>
                <Icon path={s.icon} className="w-4.5 h-4.5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ================= SEARCH + CONTROLS ================= */}
      <div className="bg-white p-3 rounded-lg border border-gray-200  shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md border border-slate-300">
          <Icon
            path={<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search by product, brand, shop, or city"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 border border-slate-300 rounded-md text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 justify-between md:justify-end">
          <span className="text-[12px] text-slate-500">
            <span className="font-medium text-slate-800">{filteredProducts.length}</span> of {totalProducts}
          </span>

          <div className="flex items-center border border-slate-200 rounded-md p-0.5 bg-slate-50">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded text-[12px] font-medium transition-colors ${viewMode === 'grid'
                ? 'bg-white text-slate-900 border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Icon path={<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>} className="w-3.5 h-3.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded text-[12px] font-medium transition-colors ${viewMode === 'table'
                ? 'bg-white text-slate-900 border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Icon path={<><path d="M3 6h18M3 12h18M3 18h18" /></>} className="w-3.5 h-3.5" />
              Table
            </button>
          </div>
        </div>
      </div>

      {/* ================= CONTENT ================= */}
      {loading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-16 text-center">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-3" />
          <div className="text-[13px] font-medium text-slate-500">Loading catalog…</div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-16 text-center space-y-2">
          <div className="w-10 h-10 rounded-md bg-slate-50 flex items-center justify-center mx-auto mb-1">
            <Icon path={<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />} className="w-5 h-5 text-slate-400" />
          </div>
          <h3 className="text-[15px] font-semibold text-slate-900">No products found</h3>
          <p className="text-[12.5px] text-slate-500 max-w-sm mx-auto">
            {search ? 'Try adjusting your search.' : 'Add your first rental product to get started.'}
          </p>
          {!search && (
            <Link
              href="/admin/products/new"
              className="inline-block bg-slate-900 text-white font-medium text-[12.5px] px-3.5 h-8 leading-8 rounded-md mt-1"
            >
              Add product
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const stockPct = product.totalQuantity
              ? Math.round((product.availableQuantity / product.totalQuantity) * 100)
              : 0;

            return (
              <div
                key={product._id}
                className="group bg-white rounded-[28px] p-3.5 border border-slate-100/80 shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Image Container */}
                  <div className="relative h-48 w-full bg-slate-100 rounded-2xl overflow-hidden mb-3.5">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50">
                        <Icon
                          path={
                            <>
                              <rect x="3" y="3" width="18" height="14" rx="2" />
                              <circle cx="8.5" cy="9" r="1.5" />
                              <path d="M21 15l-5-5-4 4-3-3-5 5" />
                            </>
                          }
                          className="w-7 h-7"
                        />
                        <span className="text-[11px] mt-1.5 font-medium">No image</span>
                      </div>
                    )}

                    {/* Gradient Overlay for bottom text visibility */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />

                    {/* Status Badge */}
                    <span
                      className={`absolute top-3 left-3 flex items-center gap-1.5 text-[10.5px] font-semibold px-3 py-1 rounded-full backdrop-blur-md shadow-sm ${product.isActive
                          ? 'bg-black/40 text-white border border-white/20'
                          : 'bg-slate-900/80 text-slate-200 border border-slate-700/50'
                        }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${product.isActive ? 'bg-emerald-400' : 'bg-slate-400'
                          }`}
                      />
                      {product.isActive ? 'Active' : 'Hidden'}
                    </span>

                    {/* Brand + City on Image */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      {product.attributes?.brand && (
                        <span className="text-white text-[11px] font-semibold tracking-wide drop-shadow-md bg-black/30 backdrop-blur-md px-2.5 py-0.5 rounded-full">
                          {product.attributes.brand}
                        </span>
                      )}
                      <span className="text-white/90 text-[10.5px] font-medium drop-shadow-md truncate ml-auto">
                        {product.storeLocation?.city}
                      </span>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="px-1 space-y-3">
                    {/* Title & Deposit Pill */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1">
                        {product.name}
                      </h3>

                      {/* Deposit Tag Badge */}
                      <div className="bg-slate-900 text-white rounded-full px-3 py-1 text-[11px] font-bold shrink-0 shadow-sm">
                        {product.deposit?.type === 'percentage'
                          ? `${product.deposit?.value}% deposit`
                          : `₹${product.deposit?.value} deposit`}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[12px] text-slate-400 line-clamp-2 leading-relaxed font-normal">
                      {product.description || 'No description provided.'}
                    </p>

                    {/* Metric Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="bg-slate-100 text-slate-600 text-[11px] font-medium px-2.5 py-1 rounded-full">
                        Available: {product.availableQuantity} / {product.totalQuantity}
                      </span>
                      {product.storeLocation?.shopName && (
                        <span className="bg-slate-100 text-slate-600 text-[11px] font-medium px-2.5 py-1 rounded-full truncate max-w-[150px]">
                          {product.storeLocation.shopName}
                        </span>
                      )}
                    </div>

                    {/* Stock Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${stockPct > 50
                              ? 'bg-emerald-500'
                              : stockPct > 15
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                          style={{ width: `${stockPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Shop location */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
                      <Icon
                        path={
                          <>
                            <path d="M3 9l1-5h16l1 5" />
                            <path d="M4 9v10a1 1 0 001 1h14a1 1 0 001-1V9" />
                            <path d="M9 21v-6h6v6" />
                          </>
                        }
                        className="w-3.5 h-3.5 shrink-0 text-slate-400"
                      />
                      <span className="truncate">
                        {product.storeLocation?.shopName} · {product.storeLocation?.address}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Pill Buttons */}
                <div className="pt-4 flex items-center gap-2">
                  <Link
                    href={`/admin/products/${product._id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[13px] h-11 rounded-full shadow-md shadow-slate-900/10 hover:shadow-lg transition-all duration-200"
                  >
                    <Icon
                      path={
                        <>
                          <path d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5" />
                          <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </>
                      }
                      className="w-3.5 h-3.5"
                    />
                    Edit product
                  </Link>

                  <button
                    onClick={() => handleDelete(product._id, product.name)}
                    className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-red-600 bg-slate-100 hover:bg-red-50 border border-slate-200/60 hover:border-red-200 rounded-full transition-all duration-200 shrink-0"
                    aria-label="Delete product"
                  >
                    <Icon
                      path={
                        <>
                          <path d="M3 6h18" />
                          <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        </>
                      }
                      className="w-4 h-4"
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-lg">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-white border-b border-slate-400/80 text-slate-600 font-medium uppercase text-[10.5px] tracking-wide">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Shop location</th>
                <th className="px-5 py-3">Deposit</th>
                <th className="px-5 py-3">Stock</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right w-[1%] whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <tr key={product._id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Icon path={<><rect x="3" y="3" width="18" height="14" rx="2" /></>} className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{product.name}</div>
                        <div className="text-[11.5px] text-slate-500">
                          {product.attributes?.brand || 'No brand'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12px]">
                    <div className="font-medium text-slate-700">{product.storeLocation?.shopName}</div>
                    <div className="text-slate-500">{product.storeLocation?.address}, {product.storeLocation?.city}</div>
                  </td>
                  <td className="px-5 py-3 text-[12.5px] font-semibold text-emerald-600 whitespace-nowrap">
                    {product.deposit?.type === 'percentage'
                      ? `${product.deposit?.value}% rent`
                      : `₹${product.deposit?.value} fixed`}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] font-medium text-slate-700">
                    {product.availableQuantity} / {product.totalQuantity}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-medium ${product.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                      {product.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/products/${product._id}`}
                        className="inline-flex items-center justify-center h-7 px-2.5 rounded border border-slate-400 text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium text-[12px] leading-none transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(product._id, product.name)}
                        className="inline-flex items-center justify-center h-7 px-2.5 rounded border border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50 font-medium text-[12px] leading-none transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}