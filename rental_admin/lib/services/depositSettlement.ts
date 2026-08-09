// lib/services/depositSettlement.ts

interface SettlementResult {
  lateFee: number;
  refundAmount: number;
  depositStatus: 'REFUNDED' | 'PARTIALLY_DEDUCTED';
}

/**
 * Pure function — decides what happens to the held deposit based on the
 * calculated late fee. Doc rule: penalty deducted from deposit, remainder
 * refunded in cash. If late fee >= deposit, refund is 0 (deposit fully consumed).
 */
export function settleDeposit(depositAmount: number, lateFee: number): SettlementResult {
  if (lateFee <= 0) {
    return {
      lateFee: 0,
      refundAmount: depositAmount,
      depositStatus: 'REFUNDED',
    };
  }

  const refundAmount = Math.max(0, Math.round((depositAmount - lateFee) * 100) / 100);

  return {
    lateFee,
    refundAmount,
    depositStatus: 'PARTIALLY_DEDUCTED',
  };
}