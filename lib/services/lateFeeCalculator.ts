// lib/services/lateFeeCalculator.ts

interface RentalPeriodConfig {
  graceHours: number;
  lateFeeRate: number;
  lateFeeUnit: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH';
  maxLateFee?: number | null;
}

const UNIT_TO_MS: Record<string, number> = {
  HOUR: 1000 * 60 * 60,
  DAY: 1000 * 60 * 60 * 24,
  WEEK: 1000 * 60 * 60 * 24 * 7,
  MONTH: 1000 * 60 * 60 * 24 * 30,
};

/**
 * Pure function — no DB calls. Takes dates + rental period config,
 * returns the late fee amount (0 if not late or still within grace period).
 */
export function calculateLateFee(
  expectedReturnDate: Date,
  actualReturnDate: Date,
  period: RentalPeriodConfig
): number {
  const diffMs = actualReturnDate.getTime() - expectedReturnDate.getTime();

  // returned on time or early
  if (diffMs <= 0) return 0;

  const graceMs = period.graceHours * UNIT_TO_MS.HOUR;
  const lateMs = diffMs - graceMs;

  // still within grace period
  if (lateMs <= 0) return 0;

  const unitMs = UNIT_TO_MS[period.lateFeeUnit];
  const lateUnits = Math.ceil(lateMs / unitMs); // round up — any partial unit counts as a full unit late

  let fee = lateUnits * period.lateFeeRate;

  if (period.maxLateFee != null && fee > period.maxLateFee) {
    fee = period.maxLateFee;
  }

  return Math.round(fee * 100) / 100; // avoid floating point mess
}

/**
 * Helper for the dashboard/order-list "is this overdue right now" check,
 * without waiting for an actual return event.
 */
export function isOverdue(expectedReturnDate: Date, now: Date = new Date()): boolean {
  return now.getTime() > expectedReturnDate.getTime();
}