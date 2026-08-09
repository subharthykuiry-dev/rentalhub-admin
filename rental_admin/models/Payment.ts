import mongoose, { Document, Model, Schema } from 'mongoose';

export type PaymentPurpose =
  | 'rental_charge'
  | 'security_deposit_hold'
  | 'security_deposit_refund'
  | 'late_fee_deduction'
  | 'late_fee_collection';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'held'
  | 'captured'
  | 'refunded'
  | 'partially_refunded'
  | 'deducted'
  | 'failed';

export interface IPayment extends Document {
  user: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  booking?: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  purpose: PaymentPurpose;
  provider: 'mock';
  method: string;
  status: PaymentStatus;
  amount: number;
  currency: 'INR';
  gatewayReference: string;
  metadata: Record<string, unknown>;
  failureReason?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    purpose: {
      type: String,
      enum: [
        'rental_charge',
        'security_deposit_hold',
        'security_deposit_refund',
        'late_fee_deduction',
        'late_fee_collection',
      ],
      required: true,
    },
    provider: { type: String, enum: ['mock'], default: 'mock' },
    method: { type: String, default: 'mock' },
    status: {
      type: String,
      enum: ['pending', 'authorized', 'held', 'captured', 'refunded', 'partially_refunded', 'deducted', 'failed'],
      default: 'pending',
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    gatewayReference: { type: String, required: true, unique: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    failureReason: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

const Payment: Model<IPayment> = mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);

export default Payment;
