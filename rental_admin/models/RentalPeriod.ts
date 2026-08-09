// models/RentalPeriod.ts
import { Schema, model, models } from 'mongoose';

const rentalPeriodSchema = new Schema({
  name: { type: String, required: true },              // e.g. "Weekly"
  unit: { type: String, enum: ['HOUR', 'DAY', 'WEEK', 'MONTH'], required: true },

  // late fee config — doc requires: hourly/daily/weekly/monthly calc, grace period, max limit
  graceHours: { type: Number, default: 0 },
  lateFeeRate: { type: Number, required: true },        // amount charged per unit late
  lateFeeUnit: { type: String, enum: ['HOUR', 'DAY', 'WEEK', 'MONTH'], required: true },
  maxLateFee: { type: Number, default: null },           // null = no cap

  // deposit config — doc requires: fixed OR percentage-based
  depositType: { type: String, enum: ['FIXED', 'PERCENTAGE'], default: 'FIXED' },
  depositValue: { type: Number, required: true },        // amount if FIXED, % if PERCENTAGE

  active: { type: Boolean, default: true },
}, { timestamps: true });

export default models.RentalPeriod || model('RentalPeriod', rentalPeriodSchema);