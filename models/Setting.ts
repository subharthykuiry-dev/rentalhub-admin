import mongoose, { Schema, Document, models, model } from 'mongoose';

export interface ISetting extends Document {
  companyName: string;
  quotationHeader: string;
  quotationFooter: string;
  termsAndConditions: string;
  defaultGracePeriodMinutes: number;
}

const SettingSchema = new Schema<ISetting>(
  {
    companyName: { type: String, default: 'Rental Admin Store' },
    quotationHeader: { type: String, default: 'Thank you for choosing our rental service!' },
    quotationFooter: { type: String, default: 'Please return products on time to avoid late fee penalties.' },
    termsAndConditions: { type: String, default: 'Security deposit will be refunded upon inspect on return.' },
    defaultGracePeriodMinutes: { type: Number, default: 30 },
  },
  { timestamps: true }
);

export default models.Setting || model<ISetting>('Setting', SettingSchema);