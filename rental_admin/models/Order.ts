import mongoose, { Document, Model, Schema } from 'mongoose';
import type { AddressSnapshot } from '@/lib/rental';

export interface IOrderItem {
  booking?: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  pricePerDay: number;
  rentalDays: number;
  rentalAmount: number;
  securityDeposit: number;
  deliveryMethod: 'delivery' | 'pickup';
  rentalStartAt: Date;
  expectedReturnAt: Date;
}

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  orderNumber: string;
  invoiceNumber: string;
  bookings: mongoose.Types.ObjectId[];
  subtotal: number;
  securityDepositTotal: number;
  securityDepositRefundTotal: number;
  securityDepositDeductedTotal: number;
  lateFeeTotal: number;
  refundTotal: number;
  deliveryFee: number;
  tax: number;
  totalAmount: number;
  deliveryMethod: 'delivery' | 'pickup';
  deliveryAddressId?: string;
  deliveryAddressSnapshot?: AddressSnapshot;
  paymentMethod: string;
  paymentStatus: string;
  paymentProvider: string;
  paymentReference?: string;
  paymentId?: string;
  status: string;
  invoiceUrl?: string;
  notes?: string;
  confirmationAt?: Date;
  completedAt?: Date;
  items: IOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    pricePerDay: { type: Number, required: true },
    rentalDays: { type: Number, required: true },
    rentalAmount: { type: Number, required: true },
    securityDeposit: { type: Number, required: true },
    deliveryMethod: { type: String, enum: ['delivery', 'pickup'], required: true },
    rentalStartAt: { type: Date, required: true },
    expectedReturnAt: { type: Date, required: true },
  },
  { _id: false }
);

const AddressSnapshotSchema = new Schema<AddressSnapshot>(
  {
    id: { type: String },
    label: { type: String },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'India' },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderNumber: { type: String, required: true, unique: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    bookings: [{ type: Schema.Types.ObjectId, ref: 'Booking' }],
    subtotal: { type: Number, required: true },
    securityDepositTotal: { type: Number, required: true },
    securityDepositRefundTotal: { type: Number, default: 0 },
    securityDepositDeductedTotal: { type: Number, default: 0 },
    lateFeeTotal: { type: Number, default: 0 },
    refundTotal: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    deliveryMethod: { type: String, enum: ['delivery', 'pickup'], required: true },
    deliveryAddressId: { type: String },
    deliveryAddressSnapshot: { type: AddressSnapshotSchema },
    paymentMethod: { type: String, default: 'mock' },
    paymentStatus: { type: String, default: 'pending' },
    paymentProvider: { type: String, default: 'mock' },
    paymentReference: { type: String },
    paymentId: { type: String },
    status: { type: String, default: 'placed' },
    invoiceUrl: { type: String },
    notes: { type: String },
    confirmationAt: { type: Date },
    completedAt: { type: Date },
    items: { type: [OrderItemSchema], default: [] },
  },
  { timestamps: true }
);

const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default Order;

