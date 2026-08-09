import { NextResponse } from 'next/server';
import { requireAdmin, unauthorized } from '@/lib/auth/require-admin';
import { listCustomers } from '@/lib/services/paymentService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const admin = requireAdmin(req);
  if (!admin) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const customers = await listCustomers(searchParams.get('search') || '', admin.email);
    return NextResponse.json({ success: true, data: customers });
  } catch (error: any) {
    console.error('Admin customers GET error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to load customers' }, { status: 500 });
  }
}
