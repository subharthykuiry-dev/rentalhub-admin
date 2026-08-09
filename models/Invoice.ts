// models/Invoice.ts
import { Schema, model, models } from 'mongoose';

const invoiceSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  invoiceNumber: { type: String, required: true, unique: true },  // e.g. INV-2026-0001
  issuedAt: { type: Date, default: Date.now },
  amount: { type: Number, required: true },              // subtotal + deposit at time of issue
  pdfUrl: { type: String, default: '' },                  // set once generated/stored
}, { timestamps: true });

export default models.Invoice || model('Invoice', invoiceSchema);