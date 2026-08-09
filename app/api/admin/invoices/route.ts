import { NextResponse } from 'next/server';
import { requireAdmin, unauthorized } from '@/lib/auth/require-admin';
import { listInvoices, markCodCollected, type InvoiceFilter } from '@/lib/services/paymentService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const admin = requireAdmin(req);
  if (!admin) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const filter = (searchParams.get('filter') || 'all') as InvoiceFilter;
    const search = searchParams.get('search') || '';

    const invoices = await listInvoices(filter, search, admin.email);
    return NextResponse.json({ success: true, data: invoices });
  } catch (error: any) {
    console.error('Admin invoices GET error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to load invoices' }, { status: 500 });
  }
}

/** Records cash collected against a COD order. */
export async function POST(req: Request) {
  const admin = requireAdmin(req);
  if (!admin) return unauthorized();

  try {
    const { orderId, action } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    if (action !== 'mark_collected') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const result = await markCodCollected(orderId, admin.email, admin.email);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Admin invoices POST error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update invoice' }, { status: 500 });
  }
}
