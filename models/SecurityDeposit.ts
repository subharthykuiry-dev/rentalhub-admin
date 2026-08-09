import mongoose, { Document, Model, Schema } from 'mongoose';

export type SecurityDepositStatus =
  | 'pending'
  | 'held'
  | 'partially_refunded'
  | 'refunded'
  | 'deducted'
  | 'released';

export type SecurityDepositTransactionType =
  | 'hold'
  | 'refund'
  | 'deduction'
  | 'release';

export interface ISecurityDepositTransaction {
  type: SecurityDepositTransactionType;
  amount: number;
  reason?: string;
  reference?: string;
  createdAt: Date;
}

export interface ISecurityDeposit extends Document {
  user: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  booking: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  amount: number;
  currency: 'INR';
  paymentStatus: 'pending' | 'held' | 'partially_refunded' | 'refunded' | 'deducted';
  holdStatus: 'pending' | 'held' | 'released';
  refundStatus: 'pending' | 'partially_refunded' | 'refunded' | 'deducted';
  status: SecurityDepositStatus;
  heldAmount: number;
  refundedAmount: number;
  deductedAmount: number;
  balanceDue: number;
  deductionReason?: string;
  refundDate?: Date;
  heldAt: Date;
  releasedAt?: Date;
  transactions: ISecurityDepositTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const SecurityDepositTransactionSchema = new Schema<ISecurityDepositTransaction>(
  {
    type: { type: String, enum: ['hold', 'refund', 'deduction', 'release'], required: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String },
    reference: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SecurityDepositSchema = new Schema<ISecurityDeposit>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    paymentStatus: {
      type: String,
      enum: ['pending', 'held', 'partially_refunded', 'refunded', 'deducted'],
      default: 'pending',
    },
    holdStatus: { type: String, default: 'pending' },
    refundStatus: { type: String, default: 'pending' },
    status: {
      type: String,
      enum: ['pending', 'held', 'partially_refunded', 'refunded', 'deducted', 'released'],
      default: 'pending',
    },
    heldAmount: { type: Number, default: 0 },
    refundedAmount: { type: Number, default: 0 },
    deductedAmount: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    deductionReason: { type: String },
    refundDate: { type: Date },
    heldAt: { type: Date, default: Date.now },
    releasedAt: { type: Date },
    transactions: { type: [SecurityDepositTransactionSchema], default: [] },
  },
  { timestamps: true }
);

const SecurityDeposit: Model<ISecurityDeposit> =
  mongoose.models.SecurityDeposit ||
  mongoose.model<ISecurityDeposit>('SecurityDeposit', SecurityDepositSchema);

export default SecurityDeposit;
