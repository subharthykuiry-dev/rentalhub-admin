import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAddress {
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

export interface IUser extends Document {
  name: string;
  email: string;
  /**
   * Second half of the sign-in credential (email + phone), so it is required
   * and stored as a plain 10-digit number — never formatted, never prefixed.
   */
  phone: number;
  profileImage?: string;
  role: 'user' | 'admin';
  addresses: IAddress[];
  wishlist: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>({
  label: { type: String, required: true, trim: true },
  street: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  zipCode: { type: String, required: true, trim: true },
  country: { type: String, required: true, default: 'India', trim: true },
  isDefault: { type: Boolean, default: false },
});

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: Number,
      required: [true, 'Please provide a phone number'],
      index: true,
    },
    profileImage: {
      type: String,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    addresses: [AddressSchema],
    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product', // Will reference Product model
      },
    ],
  },
  { timestamps: true }
);

// Prevent double compilation during hot reloads
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
