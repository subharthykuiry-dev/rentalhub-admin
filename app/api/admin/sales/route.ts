import { NextResponse } from 'next/server';
import { requireAdmin, unauthorized } from '@/lib/auth/require-admin';
import { getSalesSummary, getSalesTrend, listPaymentLedger } from '@/lib/services/paymentService';
import { getDashboardStats } from '@/lib/services/dashboardService';

export const dynamic = 'force-dynamic';

/** Everything the dashboard needs in one round trip. */
export async function GET(req: Request) {
  const admin = requireAdmin(req);
  if (!admin) return unauthorized();

  try {
    const [sales, trend, ops, ledger] = await Promise.all([
      getSalesSummary(admin.email),
      getSalesTrend(14, admin.email),
      getDashboardStats(),
      listPaymentLedger(12, admin.email),
    ]);

    return NextResponse.json({ success: true, data: { sales, trend, ops, ledger } });
  } catch (error: any) {
    console.error('Admin sales GET error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to load sales data' }, { status: 500 });
  }
}
