import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * UNIFIED PRODUCT MODEL — shared verbatim by the user app and the admin app.
 *
 * Both apps write to the same `products` collection, so this schema is the
 * superset of what each side needs:
 *   - user app reads: slug, category, dailyPrice, securityDeposit,
 *     totalStock/availableStock, images[]
 *   - admin app reads: storeLocation, deposit{type,value}, attributes,
 *     totalQuantity/availableQuantity, publishedBy, imageUrl
 *
 * The pre-validate hook below keeps the two vocabularies in sync, so a product
 * created in either app is fully renderable in the other. Keep this file
 * identical in both repos.
 */

export interface IStoreLocation {
  shopName: string;
  address: string;
  city: string;
  zipCode?: string;
  contactPhone?: string;
}

export interface IDepositConfig {
  type: 'fixed' | 'percentage';
  value: number;
}

export interface IBaseRentalRate {
  rentalPeriodId?: mongoose.Types.ObjectId;
  periodType: 'hourly' | 'daily' | 'weekly' | 'monthly';
  price: number;
}

export interface IProduct extends Document {
  // --- catalog identity (user-facing) ---
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: mongoose.Types.ObjectId;
  images: string[];
  imageUrl?: string;

  // --- pricing: flat prices are the source of truth ---
  dailyPrice: number;
  weeklyPrice?: number;
  monthlyPrice?: number;
  securityDeposit: number;
  originalPrice?: number;

  // --- ratings ---
  ratingAvg: number;
  ratingCount: number;

  // --- stock: totalStock/availableStock are canonical, *Quantity are mirrors ---
  totalStock: number;
  availableStock: number;
  totalQuantity: number;
  availableQuantity: number;

  // --- admin-side operational fields ---
  storeLocation?: IStoreLocation;
  deposit?: IDepositConfig;
  baseRentalRates: IBaseRentalRate[];
  publishedBy?: string;
  lateFeeOverride?: {
    graceHours?: number;
    lateFeeRate?: number;
    maxLateFee?: number;
  };

  // --- display attributes ---
  specifications: any;
  attributes: Record<string, unknown>;
  variants: {
    name: string;
    value: string;
    sku?: string;
    stock?: number;
    additionalPrice?: number;
  }[];
  features: string[];
  tags: string[];

  isActive: boolean;
  isBestseller: boolean;
  minRentalDays: number;
  maxRentalDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const StoreLocationSchema = new Schema<IStoreLocation>(
  {
    shopName: { type: String },
    address: { type: String },
    city: { type: String },
    zipCode: { type: String },
    contactPhone: { type: String },
  },
  { _id: false }
);

const DepositConfigSchema = new Schema<IDepositConfig>(
  {
    type: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
    value: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const BaseRentalRateSchema = new Schema<IBaseRentalRate>(
  {
    rentalPeriodId: { type: Schema.Types.ObjectId, ref: 'RentalPeriod' },
    periodType: { type: String, enum: ['hourly', 'daily', 'weekly', 'monthly'], required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    images: [{ type: String }],
    imageUrl: { type: String },

    dailyPrice: { type: Number, required: true, min: 0 },
    weeklyPrice: { type: Number },
    monthlyPrice: { type: Number },
    securityDeposit: { type: Number, required: true, min: 0, default: 0 },
    originalPrice: { type: Number },

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    // No schema defaults here on purpose: a default is applied before
    // pre('validate') runs, which would shadow whichever vocabulary the caller
    // actually supplied and break the mirroring. normalizeProductFields owns
    // the fallback instead, so documents and plain update payloads behave alike.
    totalStock: { type: Number, min: 0 },
    availableStock: { type: Number, min: 0 },
    totalQuantity: { type: Number, min: 0 },
    availableQuantity: { type: Number, min: 0 },

    storeLocation: { type: StoreLocationSchema },
    deposit: { type: DepositConfigSchema },
    baseRentalRates: { type: [BaseRentalRateSchema], default: [] },
    publishedBy: { type: String, index: true },
    lateFeeOverride: {
      graceHours: Number,
      lateFeeRate: Number,
      maxLateFee: Number,
    },

    specifications: { type: Schema.Types.Mixed, default: {} },
    attributes: { type: Schema.Types.Mixed, default: {} },
    variants: {
      type: [
        {
          name: { type: String, required: true },
          value: { type: String, required: true },
          sku: { type: String },
          stock: { type: Number, default: 0 },
          additionalPrice: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    features: [{ type: String }],
    tags: [{ type: String }],

    isActive: { type: Boolean, default: true },
    isBestseller: { type: Boolean, default: false },
    minRentalDays: { type: Number, default: 1 },
    maxRentalDays: { type: Number, default: 365 },
  },
  { timestamps: true }
);

export function slugifyProductName(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-') + `-${Date.now().toString(36)}`
  );
}

/**
 * Reconciles the two field vocabularies. Exported so API routes can run the
 * same normalization on findOneAndUpdate payloads, where document middleware
 * does not fire.
 */
export function normalizeProductFields(doc: Record<string, any>) {
  if (!doc) return doc;

  // slug
  if (!doc.slug && doc.name) {
    doc.slug = slugifyProductName(doc.name);
  }

  // stock: whichever vocabulary was supplied wins, then mirror across.
  // Only touch the fields when at least one side was actually provided, so a
  // partial update (e.g. just toggling isActive) never rewrites stock levels.
  const suppliedTotal = doc.totalStock ?? doc.totalQuantity;
  const suppliedAvailable = doc.availableStock ?? doc.availableQuantity;

  if (suppliedTotal !== undefined || suppliedAvailable !== undefined) {
    const total = suppliedTotal ?? suppliedAvailable ?? 1;
    const available = suppliedAvailable ?? total;
    doc.totalStock = total;
    doc.totalQuantity = total;
    doc.availableStock = available;
    doc.availableQuantity = available;
  }

  // deposit: admin edits deposit{type,value}, user app reads flat securityDeposit
  if (doc.deposit && typeof doc.deposit.value === 'number') {
    doc.securityDeposit =
      doc.deposit.type === 'percentage'
        ? Math.round(((doc.dailyPrice || 0) * doc.deposit.value) / 100)
        : doc.deposit.value;
  } else if (typeof doc.securityDeposit === 'number' && !doc.deposit) {
    doc.deposit = { type: 'fixed', value: doc.securityDeposit };
  }

  // images: admin uploads a single imageUrl, user app renders images[]
  if (doc.imageUrl && (!doc.images || doc.images.length === 0)) {
    doc.images = [doc.imageUrl];
  } else if (!doc.imageUrl && doc.images?.length) {
    doc.imageUrl = doc.images[0];
  }

  return doc;
}

// Mongoose 9 middleware is promise-based — there is no `next` callback.
ProductSchema.pre('validate', function (this: any) {
  normalizeProductFields(this);
});

ProductSchema.index({ isActive: 1 });
ProductSchema.index({ 'storeLocation.city': 1 });

const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
