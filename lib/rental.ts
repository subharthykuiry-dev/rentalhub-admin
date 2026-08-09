export type RentalRateType = 'hourly' | 'daily';
export type BookingLifecycleStatus =
  | 'draft'
  | 'pending_payment'
  | 'confirmed'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'active'
  | 'overdue'
  | 'returned'
  | 'completed'
  | 'cancelled';

export type DepositPaymentStatus =
  | 'pending'
  | 'held'
  | 'released'
  | 'refunded'
  | 'partially_refunded'
  | 'deducted';

export type RefundStatus =
  | 'pending'
  | 'refunded'
  | 'partially_refunded'
  | 'deducted';

export interface LateFeePolicy {
  rateType: RentalRateType;
  hourlyMultiplier: number;
  dailyMultiplier: number;
  gracePeriodMinutes: number;
}

export interface DateRangeInput {
  rentalStartAt: string | Date;
  expectedReturnAt: string | Date;
}

export interface RentalDuration {
  rentalMinutes: number;
  rentalHours: number;
  rentalDays: number;
  billingDays: number;
}

export interface LateFeeBreakdown {
  isLate: boolean;
  lateMinutes: number;
  lateHours: number;
  lateDays: number;
  rateType: RentalRateType;
  ratePerUnit: number;
  totalLateFee: number;
}

export interface DepositSettlement {
  depositAmount: number;
  deductedAmount: number;
  refundedAmount: number;
  balanceDue: number;
}

export interface AddressSnapshot {
  id?: string;
  label?: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export const DEFAULT_LATE_FEE_POLICY: LateFeePolicy = {
  rateType: 'daily',
  hourlyMultiplier: 1,
  dailyMultiplier: 0.5,
  gracePeriodMinutes: 0,
};

export function parseDateTime(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime());

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00`);
  }

  return new Date(trimmed);
}

export function isValidDate(value: Date | null | undefined) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function calculateRentalDuration(start: Date | string, end: Date | string): RentalDuration {
  const rentalStartAt = parseDateTime(start);
  const expectedReturnAt = parseDateTime(end);

  if (!isValidDate(rentalStartAt) || !isValidDate(expectedReturnAt)) {
    return {
      rentalMinutes: 0,
      rentalHours: 0,
      rentalDays: 0,
      billingDays: 0,
    };
  }

  const rentalMinutes = Math.max(
    0,
    Math.ceil((expectedReturnAt!.getTime() - rentalStartAt!.getTime()) / 60000)
  );
  const rentalHours = Math.max(0, Math.ceil(rentalMinutes / 60));
  const rentalDays = Math.max(1, Math.ceil(rentalMinutes / (60 * 24)));

  return {
    rentalMinutes,
    rentalHours,
    rentalDays,
    billingDays: rentalDays,
  };
}

export function calculateRentalPrice(
  dailyPrice: number,
  weeklyPrice: number | null | undefined,
  monthlyPrice: number | null | undefined,
  rentalDays: number
) {
  let pricePerDay = dailyPrice;

  if (rentalDays >= 30 && monthlyPrice) {
    pricePerDay = monthlyPrice / 30;
  } else if (rentalDays >= 7 && weeklyPrice) {
    pricePerDay = weeklyPrice / 7;
  }

  return Math.round(pricePerDay);
}

export function calculateRentalBreakdown(params: {
  dailyPrice: number;
  weeklyPrice?: number | null;
  monthlyPrice?: number | null;
  rentalStartAt: Date | string;
  expectedReturnAt: Date | string;
  quantity?: number;
}) {
  const duration = calculateRentalDuration(params.rentalStartAt, params.expectedReturnAt);
  const pricePerDay = calculateRentalPrice(
    params.dailyPrice,
    params.weeklyPrice ?? null,
    params.monthlyPrice ?? null,
    duration.billingDays
  );
  const quantity = Math.max(1, params.quantity ?? 1);
  const rentalAmount = Math.round(pricePerDay * duration.billingDays * quantity);

  return {
    ...duration,
    pricePerDay,
    rentalAmount,
    quantity,
  };
}

export function calculateLateFeeBreakdown(params: {
  pricePerDay: number;
  expectedReturnAt: Date | string;
  actualReturnAt: Date | string;
  policy?: Partial<LateFeePolicy>;
}) {
  const expectedReturnAt = parseDateTime(params.expectedReturnAt);
  const actualReturnAt = parseDateTime(params.actualReturnAt);

  if (!isValidDate(expectedReturnAt) || !isValidDate(actualReturnAt)) {
    return {
      isLate: false,
      lateMinutes: 0,
      lateHours: 0,
      lateDays: 0,
      rateType: params.policy?.rateType ?? DEFAULT_LATE_FEE_POLICY.rateType,
      ratePerUnit: 0,
      totalLateFee: 0,
    } satisfies LateFeeBreakdown;
  }

  const policy: LateFeePolicy = {
    rateType: params.policy?.rateType ?? DEFAULT_LATE_FEE_POLICY.rateType,
    hourlyMultiplier: params.policy?.hourlyMultiplier ?? DEFAULT_LATE_FEE_POLICY.hourlyMultiplier,
    dailyMultiplier: params.policy?.dailyMultiplier ?? DEFAULT_LATE_FEE_POLICY.dailyMultiplier,
    gracePeriodMinutes: params.policy?.gracePeriodMinutes ?? DEFAULT_LATE_FEE_POLICY.gracePeriodMinutes,
  };

  const lateMs = Math.max(0, actualReturnAt!.getTime() - expectedReturnAt!.getTime());
  const lateMinutes = Math.max(0, Math.ceil(lateMs / 60000) - policy.gracePeriodMinutes);
  const isLate = lateMinutes > 0;
  const lateHours = Math.max(0, Math.ceil(lateMinutes / 60));
  const lateDays = Math.max(0, Math.ceil(lateMinutes / (60 * 24)));

  const hourlyRate = params.pricePerDay / 24;
  let ratePerUnit = 0;
  let totalLateFee = 0;

  if (policy.rateType === 'hourly') {
    ratePerUnit = Math.round(hourlyRate * policy.hourlyMultiplier);
    totalLateFee = lateHours * ratePerUnit;
  } else {
    ratePerUnit = Math.round(params.pricePerDay * policy.dailyMultiplier);
    totalLateFee = lateDays * ratePerUnit;
  }

  return {
    isLate,
    lateMinutes,
    lateHours,
    lateDays,
    rateType: policy.rateType,
    ratePerUnit,
    totalLateFee: Math.max(0, Math.round(totalLateFee)),
  } satisfies LateFeeBreakdown;
}

export function calculateLateFees(
  pricePerDay: number,
  rentalEnd: Date,
  actualReturn: Date
) {
  return calculateLateFeeBreakdown({
    pricePerDay,
    expectedReturnAt: rentalEnd,
    actualReturnAt: actualReturn,
  }).totalLateFee;
}

export function calculateDepositSettlement(params: {
  depositAmount: number;
  deductedAmount?: number;
}) {
  const depositAmount = Math.max(0, Math.round(params.depositAmount || 0));
  const deductedAmount = Math.min(
    depositAmount,
    Math.max(0, Math.round(params.deductedAmount || 0))
  );
  const refundedAmount = Math.max(0, depositAmount - deductedAmount);
  const balanceDue = Math.max(0, Math.round((params.deductedAmount || 0) - depositAmount));

  return {
    depositAmount,
    deductedAmount,
    refundedAmount,
    balanceDue,
  } satisfies DepositSettlement;
}

export function generateOrderNumber(prefix = 'RH-ORD') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function generatePaymentReference(prefix = 'PAY') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function buildAddressSnapshot(address: {
  _id?: string | { toString(): string };
  id?: string;
  label?: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
}) {
  return {
    id: address.id || (address._id ? address._id.toString() : undefined),
    label: address.label || 'Home',
    street: address.street,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    country: address.country || 'India',
  } satisfies AddressSnapshot;
}

