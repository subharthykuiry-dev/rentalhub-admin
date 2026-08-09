// lib/services/orderService.ts
//
// Admin-side order operations, built on the SAME Order/Booking engine the user
// app checkout uses (lib/rental-service.ts). The old RentalOrder model is gone —
// a walk-in order and an online order are now the same kind of record, which is
// what makes the admin dashboard able to see customer orders at all.

import connectToDatabase from '@/config/db';
import Booking from '@/models/Booking';
import Order from '@/models/Order';
import Invoice from '@/models/Invoice';
import User from '@/models/User';
import {
  createRentalCheckoutOrder,
  updateBookingLifecycle,
  markOverdueBookings,
  serializeBookingDoc,
  serializeOrderDoc,
} from '@/lib/rental-service';

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await Invoice.countDocuments({
    invoiceNumber: { $regex: `^INV-${year}-` },
  });
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

interface CreateWalkInInput {
  userId: string;
  deliveryMode: 'SHIP' | 'STORE_PICKUP';
  deliveryAddressId?: string | null;
  paymentMethod?: string;
  items: {
    productId: string;
    quantity: number;
    rentalStart: string | Date;
    rentalEnd: string | Date;
  }[];
}

/**
 * Walk-in / in-store order created by an admin on a customer's behalf.
 * Runs the identical availability check, deposit hold and payment ledger as an
 * online checkout, then attaches a sequential invoice.
 */
export async function createWalkInOrder(input: CreateWalkInInput) {
  await connectToDatabase();

  const result = await createRentalCheckoutOrder({
    userId: input.userId,
    items: input.items,
    deliveryMethod: input.deliveryMode === 'SHIP' ? 'delivery' : 'pickup',
    deliveryAddressId: input.deliveryAddressId,
    paymentMethod: input.paymentMethod || 'cash',
  });

  if (!result.ok) return result;

  const order = result.data.order;
  await Order.findByIdAndUpdate(order.id, { notes: 'Walk-in order created by admin' });

  const invoice = await Invoice.create({
    orderId: order.id,
    invoiceNumber: await generateInvoiceNumber(),
    amount: order.totalAmount,
  });

  return {
    ok: true as const,
    status: 201,
    data: { ...result.data, invoice },
  };
}

export async function markPickedUp(bookingId: string) {
  return updateBookingLifecycle({ bookingId, action: 'confirm_pickup' });
}

interface ProcessReturnInput {
  bookingId: string;
  condition?: 'good' | 'damaged' | 'missing_accessories';
  /** Pass 0 to waive the auto-calculated late fee. Omit to accept it. */
  lateFeeOverride?: number;
  damageCharge?: number;
  missingAccessories?: string[];
  notes?: string;
}

/**
 * Return inspection + deposit settlement. Unlike the customer-initiated return,
 * the admin can waive the late fee and add damage / missing-accessory charges,
 * both of which are deducted from the held deposit.
 */
export async function processReturn(input: ProcessReturnInput) {
  return updateBookingLifecycle({
    bookingId: input.bookingId,
    action: 'return',
    returnCondition: input.condition,
    damageNotes: input.notes,
    missingAccessories: input.missingAccessories,
    lateFeeOverride: input.lateFeeOverride,
    damageCharge: input.damageCharge,
  });
}

export async function flagOverdueOrders() {
  await markOverdueBookings();
  return Booking.countDocuments({ status: 'overdue' });
}

/**
 * Order list for /admin/orders. Returns one row per booking (a rental line),
 * which is what the operational views care about — with customer and product
 * joined in.
 */
export async function listBookings(filters: { status?: string; search?: string } = {}) {
  await connectToDatabase();
  await markOverdueBookings();

  const where: Record<string, unknown> = {};
  if (filters.status && filters.status !== 'all') {
    where.status = filters.status;
  }

  if (filters.search) {
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
      ],
    }).select('_id');
    where.user = { $in: matchingUsers.map((u) => u._id) };
  }

  const bookings = await Booking.find(where)
    .populate('user', 'name email phone')
    .populate({ path: 'product', select: 'name imageUrl images storeLocation' })
    .populate('order', 'orderNumber invoiceNumber paymentStatus')
    .sort({ createdAt: -1 })
    .limit(200);

  return bookings.map((booking) => serializeBookingDoc(booking));
}

export async function getBookingDetail(bookingId: string) {
  await connectToDatabase();

  const booking = await Booking.findById(bookingId)
    .populate('user', 'name email phone addresses')
    .populate({ path: 'product', populate: { path: 'category', select: 'name slug' } })
    .populate('order');

  if (!booking) return null;
  return serializeBookingDoc(booking);
}

export async function listOrders(filters: { status?: string } = {}) {
  await connectToDatabase();

  const where: Record<string, unknown> = {};
  if (filters.status && filters.status !== 'all') where.status = filters.status;

  const orders = await Order.find(where)
    .populate('user', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(200);

  return orders.map((order) => serializeOrderDoc(order));
}
