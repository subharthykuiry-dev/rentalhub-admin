import { NextResponse } from 'next/server';
import { requireAdmin, unauthorized } from '@/lib/auth/require-admin';
import {
  approveOrder,
  cancelOrder,
  deleteOrder,
  listBookings,
  markPickedUp,
  processReturn,
} from '@/lib/services/orderService';

export const dynamic = 'force-dynamic';

/** Operational rental lines (one row per booking) for /admin/orders. */
export async function GET(req: Request) {
  const admin = requireAdmin(req);
  if (!admin) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const bookings = await listBookings({
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      adminEmail: admin.email,
    });

    return NextResponse.json({ success: true, data: bookings });
  } catch (error: any) {
    console.error('Admin orders GET error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to load orders' }, { status: 500 });
  }
}

/**
 * Order/booking state transitions.
 *
 * Order-level actions (approve, cancel) take an `orderId`; booking-level ones
 * (pickup, return) take a `bookingId`, because a single order can hold several
 * rental lines that are handed over and returned independently.
 */
export async function POST(req: Request) {
  const admin = requireAdmin(req);
  if (!admin) return unauthorized();

  try {
    const body = await req.json();
    const { action, orderId, bookingId } = body;

    let result: any;
    switch (action) {
      case 'approve':
        if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        result = await approveOrder(orderId, admin.email);
        break;
      case 'cancel':
        if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        result = await cancelOrder(orderId, admin.email);
        break;
      case 'confirm_pickup':
        if (!bookingId) return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
        result = await markPickedUp(bookingId, admin.email);
        break;
      case 'return':
        if (!bookingId) return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
        result = await processReturn({
          bookingId,
          condition: body.condition,
          lateFeeOverride: body.lateFeeOverride,
          damageCharge: body.damageCharge,
          notes: body.notes,
          missingAccessories: body.missingAccessories,
          adminEmail: admin.email,
        });
        break;
      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Admin orders POST error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update order' }, { status: 500 });
  }
}

/** Permanently deletes an order and its bookings, payments and deposits. */
export async function DELETE(req: Request) {
  const admin = requireAdmin(req);
  if (!admin) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

    const result = await deleteOrder(orderId, admin.email);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Admin orders DELETE error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete order' }, { status: 500 });
  }
}
