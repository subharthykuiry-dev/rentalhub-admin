import mongoose, { Document, Model, Schema } from 'mongoose';
import type {
  AddressSnapshot,
  BookingLifecycleStatus,
  DepositPaymentStatus,
  RefundStatus,
  RentalRateType,
} from '@/lib/rental';

export type BookingPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type BookingPickupConfirmationStatus = 'pending' | 'confirmed';
export type BookingReturnStatus = 'pending' | 'returned' | 'completed' | 'cancelled';

export interface IBookingDepositTransaction {
  type: 'hold' | 'refund' | 'deduction' | 'release';
  amount: number;
  reason?: string;
  reference?: string;
  createdAt: Date;
}

export interface IBooking extends Document {
  user: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  payment?: mongoose.Types.ObjectId;
  securityDepositRecord?: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  quantity: number;
  rentalStart: Date;
  rentalEnd: Date;
  rentalStartAt: Date;
  expectedReturnAt: Date;
  actualPickupAt?: Date;
  actualReturnDate?: Date;
  actualReturnAt?: Date;
  rentalDays: number;
  rentalMinutes: number;
  pricePerDay: number;
  rentalAmount: number;
  securityDeposit: number;
  totalAmount: number;
  deliveryMethod: 'delivery' | 'pickup';
  deliveryAddressId?: string;
  deliveryAddressSnapshot?: AddressSnapshot;
  pickupLocation?: string;
  pickupScheduledAt?: Date;
  pickupConfirmedAt?: Date;
  pickupConfirmationStatus: BookingPickupConfirmationStatus;
  returnConfirmationStatus: BookingPickupConfirmationStatus;
  returnStatus: BookingReturnStatus;
  status: BookingLifecycleStatus;
  paymentStatus: BookingPaymentStatus;
  paymentMethod: string;
  paymentId?: string;
  invoiceNumber?: string;
  depositPaymentStatus: DepositPaymentStatus;
  depositHeldStatus: 'pending' | 'held' | 'released';
  depositRefundStatus: RefundStatus;
  depositRefunded: boolean;
  depositRefundAmount: number;
  depositDeductedAmount: number;
  refundDate?: Date;
  deductionReason?: string;
  balanceDue: number;
  overdue: boolean;
  lateFeeRateType: RentalRateType;
  lateFeeRate: number;
  lateDurationMinutes: number;
  lateDurationHours: number;
  lateDurationDays: number;
  lateFees: number;
  damageCharge: number;
  returnCondition?: string;
  damageNotes?: string;
  missingAccessories: string[];
  notes?: string;
  reservationExpiresAt?: Date;
  depositHistory: IBookingDepositTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const DepositHistorySchema = new Schema<IBookingDepositTransaction>(
  {
    type: { type: String, enum: ['hold', 'refund', 'deduction', 'release'], required: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String },
    reference: { type: String },
    createdAt: { type: Date, default: Date.now },
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

const BookingSchema = new Schema<IBooking>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    securityDepositRecord: { type: Schema.Types.ObjectId, ref: 'SecurityDeposit' },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    quantity: { type: Number, default: 1, min: 1 },
    rentalStart: { type: Date, required: true, index: true },
    rentalEnd: { type: Date, required: true, index: true },
    rentalStartAt: { type: Date, required: true },
    expectedReturnAt: { type: Date, required: true, index: true },
    actualPickupAt: { type: Date },
    actualReturnDate: { type: Date },
    actualReturnAt: { type: Date },
    rentalDays: { type: Number, required: true, min: 1 },
    rentalMinutes: { type: Number, default: 0 },
    pricePerDay: { type: Number, required: true },
    rentalAmount: { type: Number, required: true },
    securityDeposit: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    deliveryMethod: { type: String, enum: ['delivery', 'pickup'], required: true },
    deliveryAddressId: { type: String },
    deliveryAddressSnapshot: { type: AddressSnapshotSchema },
    pickupLocation: { type: String, default: 'RentalHub Store' },
    pickupScheduledAt: { type: Date },
    pickupConfirmedAt: { type: Date },
    pickupConfirmationStatus: {
      type: String,
      enum: ['pending', 'confirmed'],
      default: 'pending',
    },
    returnConfirmationStatus: {
      type: String,
      enum: ['pending', 'confirmed'],
      default: 'pending',
    },
    returnStatus: {
      type: String,
      enum: ['pending', 'returned', 'completed', 'cancelled'],
      default: 'pending',
    },
    status: {
      type: String,
      enum: [
        'draft',
        'pending_payment',
        'confirmed',
        'ready_for_pickup',
        'out_for_delivery',
        'active',
        'overdue',
        'returned',
        'completed',
        'cancelled',
      ],
      default: 'draft',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentMethod: { type: String, default: 'mock' },
    paymentId: { type: String },
    invoiceNumber: { type: String, index: true },
    depositPaymentStatus: {
      type: String,
      enum: ['pending', 'held', 'released', 'refunded', 'partially_refunded', 'deducted'],
      default: 'pending',
    },
    depositHeldStatus: {
      type: String,
      enum: ['pending', 'held', 'released'],
      default: 'pending',
    },
    depositRefundStatus: {
      type: String,
      enum: ['pending', 'refunded', 'partially_refunded', 'deducted'],
      default: 'pending',
    },
    depositRefunded: { type: Boolean, default: false },
    depositRefundAmount: { type: Number, default: 0 },
    depositDeductedAmount: { type: Number, default: 0 },
    refundDate: { type: Date },
    deductionReason: { type: String },
    balanceDue: { type: Number, default: 0 },
    overdue: { type: Boolean, default: false, index: true },
    lateFeeRateType: {
      type: String,
      enum: ['hourly', 'daily'],
      default: 'daily',
    },
    lateFeeRate: { type: Number, default: 0 },
    lateDurationMinutes: { type: Number, default: 0 },
    lateDurationHours: { type: Number, default: 0 },
    lateDurationDays: { type: Number, default: 0 },
    lateFees: { type: Number, default: 0 },
    damageCharge: { type: Number, default: 0 },
    returnCondition: { type: String },
    damageNotes: { type: String },
    missingAccessories: [{ type: String }],
    notes: { type: String },
    reservationExpiresAt: { type: Date, index: true },
    depositHistory: { type: [DepositHistorySchema], default: [] },
  },
  { timestamps: true }
);

BookingSchema.index({
  product: 1,
  status: 1,
  rentalStartAt: 1,
  expectedReturnAt: 1,
});

const Booking: Model<IBooking> =
  mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);

export default Booking;

