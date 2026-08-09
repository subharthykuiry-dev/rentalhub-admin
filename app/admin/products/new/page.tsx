'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewProductPage() {
  const router = useRouter();

  // State
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    isActive: true,
    publishedBy: '', // 👈 Updated field name

    // Catalog placement — required for the product to appear in the
    // customer storefront's category browse.
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

    // Attributes
    brand: '',
    manufacturer: '',
    color: '',
    size: '',
  });

  // Load categories for the catalog dropdown
  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.data);
      })
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // 1. SAFELY READ ADMIN DATA FROM LOCALSTORAGE ON MOUNT
  useEffect(() => {
    const storedAdmin = localStorage.getItem('admin');
    if (storedAdmin) {
      try {
        const adminObj = JSON.parse(storedAdmin);
        if (adminObj?.email) {
          setFormData((prev) => ({ ...prev, publishedBy: adminObj.email }));
        }
      } catch (err) {
        console.error('Failed to parse admin from localStorage:', err);
      }
    }
  }, []);

  // 2. Function to upload local file to Cloudinary via API
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
      console.error('Image Upload Error:', error);
      alert('Failed to upload image. Please check your network or Cloudinary API keys.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // 3. Local File Input Handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    const uploadedUrl = await uploadImageToCloudinary(file);
    if (uploadedUrl) {
      setFormData((prev) => ({ ...prev, imageUrl: uploadedUrl }));
    } else {
      setImagePreview('');
    }
  };

  // 4. Remove selected image
  const handleRemoveImage = () => {
    setImagePreview('');
    setFormData((prev) => ({ ...prev, imageUrl: '' }));
  };

  // 5. Form Submission (Save Product to MongoDB)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadingImage) {
      alert('Please wait until the image finishes uploading to Cloudinary!');
      return;
    }

    if (!formData.category) {
      alert('Please select a category — it decides where this product appears in the customer catalog.');
      return;
    }

    try {
      setSubmitting(true);

      // Payload matching Product.ts schema
      const payload = {
        name: formData.name,
        description: formData.description,
        imageUrl: formData.imageUrl,
        isActive: formData.isActive,
        publishedBy: formData.publishedBy, // 👈 INCLUDED IN PAYLOAD HERE
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
        availableQuantity: Number(formData.totalQuantity),
        attributes: {
          brand: formData.brand,
          manufacturer: formData.manufacturer,
          color: formData.color,
          size: formData.size,
        },
      };

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();

      if (responseData.success) {
        alert('Product created successfully!');
        router.push('/admin/products');
      } else {
        alert('Failed to save product: ' + (responseData.error || 'Server error'));
      }
    } catch (error) {
      console.error('Submit Error:', error);
      alert('Error creating product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/products"
            className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mb-4"
          >
            ← Back to Products List
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Add New Rental Product</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ================= 1. GENERAL INFO ================= */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-base font-semibold text-slate-800">
              1. Basic Information & Image
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
                Product Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. DSLR Camera Canon EOS R6"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Read-only Publisher Indicator */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Publishing Admin
              </label>
              <input
                type="text"
                disabled
                value={formData.publishedBy || 'Logged in Admin'}
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg text-sm"
              />
            </div>

            {/* Image Upload Area */}
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-semibold text-slate-600">
                Product Image File *
              </label>

              {imagePreview ? (
                <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group">
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
                      Click or drag a file to upload image
                    </div>
                    <p className="text-[11px] text-slate-400">
                      PNG, JPG, WEBP up to 5MB (Uploaded directly to Cloudinary)
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
                placeholder="Enter detailed description for customer catalog..."
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
                placeholder="Downtown Flagship Store"
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
                placeholder="New York"
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
                placeholder="123 Main Street, Suite 4B"
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
                placeholder="10001"
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
                placeholder="+1 555-0199"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* ================= 3. DEPOSIT SETTINGS ================= */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
            <span>🛡️</span> 3. Security Deposit Settings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </div>

        {/* ================= 4. ATTRIBUTES & INVENTORY ================= */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
            <span>🏷️</span> 4. Attributes & Total Units
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Brand
              </label>
              <input
                type="text"
                placeholder="Canon"
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
                placeholder="Canon Inc."
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
                placeholder="Black"
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
                placeholder="Full Frame"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2 md:col-span-4 border-t pt-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Total Inventory Quantity *
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.totalQuantity}
                onChange={(e) => setFormData({ ...formData, totalQuantity: Number(e.target.value) })}
                className="w-full md:w-1/2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Available quantity will automatically set to {formData.totalQuantity} units upon creation.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
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
            {submitting ? 'Saving Product...' : uploadingImage ? 'Uploading Image...' : 'Save Product'}
          </button>
        </div>
      </form>
    </div>
  );
}