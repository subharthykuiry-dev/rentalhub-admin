'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    isActive: true,
    publishedBy: '', // 👈 Safe initialization (populated in useEffect)

    // Catalog placement — required for storefront category browse
    category: '',

    // Rental pricing (source of truth for customer-facing rates)
    dailyPrice: 0,
    weeklyPrice: 0,
    monthlyPrice: 0,

    // Store Location
    shopName: '',
    address: '',
    city: '',
    zipCode: '',
    contactPhone: '',

    // Deposit Configuration
    depositType: 'fixed' as 'fixed' | 'percentage',
    depositValue: 0,

    // Stock
    totalQuantity: 1,
    availableQuantity: 1,

    // Attributes
    brand: '',
    manufacturer: '',
    color: '',
    size: '',
  });

  // Helper function to extract admin email safely from localStorage
  const getAdminEmailFromLocalStorage = (): string => {
    try {
      const storedAdmin = localStorage.getItem('admin');
      if (storedAdmin) {
        if (storedAdmin.startsWith('{')) {
          const adminObj = JSON.parse(storedAdmin);
          return adminObj?.email || adminObj?.name || '';
        } else if (storedAdmin.includes('@')) {
          return storedAdmin;
        }
      }
    } catch (err) {
      console.error('Error parsing admin from localStorage:', err);
    }
    return '';
  };

  // Load categories for the catalog dropdown
  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.data);
      })
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // 1. Fetch Existing Product Data on Load
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const productId = params?.id;
        const res = await fetch(`/api/products/${productId}`);
        const result = await res.json();

        if (result.success) {
          const product = result.data;

          // Determine publisher: use DB record or fallback to current logged-in admin
          const publisherEmail = product.publishedBy || getAdminEmailFromLocalStorage();

          setFormData({
            name: product.name || '',
            description: product.description || '',
            imageUrl: product.imageUrl || '',
            isActive: product.isActive ?? true,
            publishedBy: publisherEmail,

            // category comes back populated from the API, so accept either shape
            category: product.category?._id || product.category || '',
            dailyPrice: product.dailyPrice || 0,
            weeklyPrice: product.weeklyPrice || 0,
            monthlyPrice: product.monthlyPrice || 0,

            shopName: product.storeLocation?.shopName || '',
            address: product.storeLocation?.address || '',
            city: product.storeLocation?.city || '',
            zipCode: product.storeLocation?.zipCode || '',
            contactPhone: product.storeLocation?.contactPhone || '',

            depositType: product.deposit?.type || 'fixed',
            depositValue: product.deposit?.value || 0,

            totalQuantity: product.totalQuantity || 1,
            availableQuantity: product.availableQuantity || 1,

            brand: product.attributes?.brand || '',
            manufacturer: product.attributes?.manufacturer || '',
            color: product.attributes?.color || '',
            size: product.attributes?.size || '',
          });

          if (product.imageUrl) {
            setImagePreview(product.imageUrl);
          }
        } else {
          alert(result.error || 'Failed to find product');
          router.push('/admin/products');
        }
      } catch (error) {
        console.error('Fetch Product Error:', error);
        alert('Error loading product details.');
      } finally {
        setLoading(false);
      }
    };

    if (params?.id) {
      fetchProduct();
    }
  }, [params?.id, router]);

  // 2. Upload Image File to Cloudinary
  const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
    const data = new FormData();
    data.append('file', file);

    try {
      setUploadingImage(true);
      const res = await fetch('/api/uploads/products', {
        method: 'POST',
        body: data,
      });

      const result = await res.json();

      if (result.success) {
        return result.url;
      } else {
        alert('Cloudinary upload failed: ' + (result.error || 'Unknown error'));
        return null;
      }
    } catch (error) {
      console.error('Upload Error:', error);
      alert('Failed to upload image. Please check network connectivity.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // 3. Local File Selection Handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Set immediate preview
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    // Upload to Cloudinary
    const uploadedUrl = await uploadImageToCloudinary(file);
    if (uploadedUrl) {
      setFormData((prev) => ({ ...prev, imageUrl: uploadedUrl }));
    }
  };

  // 4. Remove Current Image
  const handleRemoveImage = () => {
    setImagePreview('');
    setFormData((prev) => ({ ...prev, imageUrl: '' }));
  };

  // 5. Submit Changes to MongoDB (PUT Request)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadingImage) {
      alert('Please wait until the new image completes uploading!');
      return;
    }

    if (!formData.category) {
      alert('Please select a category — it decides where this product appears in the customer catalog.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        name: formData.name,
        description: formData.description,
        imageUrl: formData.imageUrl,
        isActive: formData.isActive,
        publishedBy: formData.publishedBy, // 👈 Preserved / updated in payload
        category: formData.category || undefined,
        dailyPrice: Number(formData.dailyPrice),
        weeklyPrice: Number(formData.weeklyPrice) || undefined,
        monthlyPrice: Number(formData.monthlyPrice) || undefined,
        storeLocation: {
          shopName: formData.shopName,
          address: formData.address,
          city: formData.city,
          zipCode: formData.zipCode,
          contactPhone: formData.contactPhone,
        },
        deposit: {
          type: formData.depositType,
          value: Number(formData.depositValue),
        },
        totalQuantity: Number(formData.totalQuantity),
        availableQuantity: Number(formData.availableQuantity),
        attributes: {
          brand: formData.brand,
          manufacturer: formData.manufacturer,
          color: formData.color,
          size: formData.size,
        },
      };

      const res = await fetch(`/api/products/${params?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.success) {
        alert('Product updated successfully!');
        router.push('/admin/products');
      } else {
        alert('Failed to update product: ' + (result.error || 'Server error'));
      }
    } catch (error) {
      console.error('Update Product Error:', error);
      alert('Error saving product updates.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-3">
        <div className="animate-spin text-4xl inline-block text-blue-600">⌛</div>
        <p className="text-sm font-semibold text-slate-600">Fetching product details...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-center">
      <div className="max-w-4xl w-full space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/admin/products"
              className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mb-4"
            >
              ← Back to Products List
            </Link>
            <h1 className="text-2xl font-bold text-slate-800">
              Edit Product <span className="text-slate-400 font-mono text-sm">#{params?.id}</span>
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ================= 1. BASIC DETAILS & IMAGE ================= */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-base font-semibold text-slate-800">
                1. Basic Details & Product Image
              </h2>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                Active on Rental Catalog
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Read-Only Published By Field */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Published By (Admin)
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.publishedBy || 'Logged in Admin'}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-600 rounded-lg text-sm font-medium cursor-not-allowed"
                />
              </div>

              {/* Direct Image File Upload Section */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Product Image File
                </label>

                {imagePreview ? (
                  <div className="flex items-center gap-4">
                    <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group shrink-0">
                      <img
                        src={imagePreview}
                        alt="Product Preview"
                        className="w-full h-full object-cover"
                      />
                      {uploadingImage ? (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-xs font-medium">
                          <div className="animate-spin text-xl mb-1">⌛</div>
                          Uploading...
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full shadow-md transition-all"
                          title="Remove image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors">
                        Change Image File
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Selecting a new file automatically uploads it to Cloudinary.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-1 text-slate-500">
                      <span className="text-3xl block">📁</span>
                      <div className="text-xs font-semibold text-slate-700">
                        Click or drag a file to upload new product image
                      </div>
                      <p className="text-[11px] text-slate-400">
                        PNG, JPG, WEBP up to 5MB (Direct Cloudinary upload)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ========== 1b. CATALOG & RENTAL PRICING ========== */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
              <span>🏷️</span> Catalog &amp; Rental Pricing
            </h2>
            <p className="text-[11px] text-slate-500 -mt-2">
              These fields drive what customers see in the storefront. A product
              needs a category and a daily price to be rentable.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a category…</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Daily Rental Price (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.dailyPrice}
                  onChange={(e) => setFormData({ ...formData, dailyPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Weekly Price (₹) <span className="text-slate-400 font-normal">— optional</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Leave blank to bill 7 × daily"
                  value={formData.weeklyPrice || ''}
                  onChange={(e) => setFormData({ ...formData, weeklyPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Monthly Price (₹) <span className="text-slate-400 font-normal">— optional</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Leave blank to bill 30 × daily"
                  value={formData.monthlyPrice || ''}
                  onChange={(e) => setFormData({ ...formData, monthlyPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ================= 2. STORE LOCATION ================= */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
              <span>🏪</span> 2. Pickup Store Location
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Shop Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.shopName}
                  onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Zip Code
                </label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Store Phone Number
                </label>
                <input
                  type="text"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ================= 3. SECURITY DEPOSIT & STOCK ================= */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
              <span>📦</span> 3. Deposit & Stock Quantities
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Deposit Type
                </label>
                <select
                  value={formData.depositType}
                  onChange={(e) =>
                    setFormData({ ...formData, depositType: e.target.value as 'fixed' | 'percentage' })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fixed">Fixed Amount ($)</option>
                  <option value="percentage">Percentage of Rental (%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Deposit Value *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.depositValue}
                  onChange={(e) => setFormData({ ...formData, depositValue: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="hidden md:block"></div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Total Inventory Quantity *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.totalQuantity}
                  onChange={(e) => setFormData({ ...formData, totalQuantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Currently Available Quantity *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.availableQuantity}
                  onChange={(e) => setFormData({ ...formData, availableQuantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ================= 4. DISPLAY ATTRIBUTES ================= */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
              <span>🏷️</span> 4. Display Attributes
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Brand
                </label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Manufacturer
                </label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Size / Specs
                </label>
                <input
                  type="text"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href="/admin/products"
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={uploadingImage || submitting}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium text-sm shadow-sm transition-all flex items-center gap-2"
            >
              {submitting ? 'Updating...' : uploadingImage ? 'Uploading Image...' : 'Update Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}