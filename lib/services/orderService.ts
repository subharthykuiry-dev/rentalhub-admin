// lib/services/orderService.ts
//
// Admin-side order operations, built on the SAME Order/Booking engine the user
// app checkout uses (lib/rental-service.ts). The old RentalOrder model is gone —
// a walk-in order and an online order are now the same kind of record, which is
// what makes the admin dashboard able to see customer orders at all.

import mongoose from 'mongoose';
import connectToDatabase from '@/config/db';
import Booking from '@/models/Booking';
import Order from '@/models/Order';
import Invoice from '@/models/Invoice';
import Payment from '@/models/Payment';
import SecurityDeposit from '@/models/SecurityDeposit';
import User from '@/models/User';
import { getAdminProductIds } from './paymentService';
import {
  createRentalCheckoutOrder,
  updateBookingLifecycle,
  markOverdueBookings,
  holdBookingStock,
  releaseBookingStock,
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
    // A walk-in is settled at the counter, so it follows the same
    // collect-on-handover lifecycle as a COD order.
    paymentMode: 'cod',
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

export async function markPickedUp(bookingId: string, adminEmail?: string) {
  const denied = await assertOwnsBooking(bookingId, adminEmail);
  if (denied) return denied;
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
export async function processReturn(input: ProcessReturnInput & { adminEmail?: string }) {
  const denied = await assertOwnsBooking(input.bookingId, input.adminEmail);
  if (denied) return denied;

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
export async function listBookings(
  filters: { status?: string; search?: string; adminEmail?: string } = {}
) {
  await connectToDatabase();
  await markOverdueBookings();

  const where: Record<string, unknown> = {};

  // Ownership is per rental line: an admin sees only bookings for products
  // they published, even when the order also contains another seller's items.
  const productIds = await getAdminProductIds(filters.adminEmail);
  if (productIds) {
    if (productIds.length === 0) return [];
    where.product = { $in: productIds };
  }

  if (filters.status && filters.status !== 'all') {
    where.status = filters.status;
  }

  if (filters.search) {
    const term = filters.search.trim();
    // Phone is what a customer actually reads out at the counter, so digits are
    // matched against the phone field with any formatting stripped, while the
    // same term still matches a name, email or order number.
    const digits = term.replace(/\D/g, '');

    const userOr: Record<string, unknown>[] = [
      { name: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
    ];
    if (digits.length >= 4) {
      // Phone is a Number on some records and a String on others, and $regex
      // cannot be applied to a numeric field — cast before matching so a
      // partial number (e.g. the last 6 digits) works for both shapes.
      userOr.push({
        $expr: {
          $regexMatch: { input: { $toString: { $ifNull: ['$phone', ''] } }, regex: digits },
        },
      });
    }

    const matchingUsers = await User.find({ $or: userOr }).select('_id');
    const matchingOrders = await Order.find({
      orderNumber: { $regex: term, $options: 'i' },
    }).select('_id');

    where.$or = [
      { user: { $in: matchingUsers.map((u) => u._id) } },
      { order: { $in: matchingOrders.map((o) => o._id) } },
    ];
  }

  const bookings = await Booking.find(where)
    .populate('user', 'name email phone')
    .populate({ path: 'product', select: 'name imageUrl images storeLocation' })
    .populate('order', 'orderNumber invoiceNumber paymentStatus paymentProvider paymentMethod totalAmount')
    .sort({ createdAt: -1 })
    .limit(200);

  return bookings.map((booking: any) => {
    const row = serializeBookingDoc(booking);
    // Payment state lives on the order, but the operational list is per-booking,
    // so surface it on each row rather than making the UI dig for it.
    return {
      ...row,
      orderNumber: booking.order?.orderNumber ?? null,
      paymentStatus: booking.order?.paymentStatus ?? row.paymentStatus,
      paymentProvider: booking.order?.paymentProvider ?? null,
      orderTotal: booking.order?.totalAmount ?? null,
      customerName: booking.user?.name ?? 'Unknown',
      customerEmail: booking.user?.email ?? '',
      customerPhone: booking.user?.phone ? String(booking.user.phone) : '',
      productName: booking.product?.name ?? 'Unknown product',
    };
  });
}

export async function getBookingDetail(bookingId: string, adminEmail?: string) {
  await connectToDatabase();

  const denied = await assertOwnsBooking(bookingId, adminEmail);
  if (denied) return null;

  const booking = await Booking.findById(bookingId)
    .populate('user', 'name email phone addresses')
    .populate({ path: 'product', populate: { path: 'category', select: 'name slug' } })
    .populate('order');

  if (!booking) return null;
  return serializeBookingDoc(booking);
}

/**
 * Confirms the order contains at least one product this admin published.
 * Returns an error result when it does not, or null when access is allowed.
 */
async function assertOwnsOrder(orderId: string, adminEmail?: string) {
  const productIds = await getAdminProductIds(adminEmail);
  if (!productIds) return null;

  const owns = productIds.length
    ? await Booking.exists({ order: orderId, product: { $in: productIds } })
    : null;

  if (!owns) {
    return { ok: false as const, status: 403, error: 'This order belongs to another seller.' };
  }
  return null;
}

/** Same check, but for a single rental line. */
async function assertOwnsBooking(bookingId: string, adminEmail?: string) {
  const productIds = await getAdminProductIds(adminEmail);
  if (!productIds) return null;

  const owns = productIds.length
    ? await Booking.exists({ _id: bookingId, product: { $in: productIds } })
    : null;

  if (!owns) {
    return { ok: false as const, status: 403, error: 'This rental belongs to another seller.' };
  }
  return null;
}

/**
 * Permanently removes an order and everything hanging off it.
 *
 * `order.bookings`, `order.items[].booking` and the booking's own back
 * reference can drift apart, so the union of all three is deleted rather than
 * trusting any single side of the link — otherwise orphaned bookings keep
 * reserving stock forever.
 */
export async function deleteOrder(orderId: string, adminEmail?: string) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return { ok: false as const, status: 404, error: 'Order not found' };
  }

  await connectToDatabase();

  const denied = await assertOwnsOrder(orderId, adminEmail);
  if (denied) return denied;
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) return { ok: false as const, status: 404, error: 'Order not found' };

      const backLinked = await Booking.find({ order: order._id }).select('_id').session(session);
      const bookingIds = [
        ...new Map(
          [
            ...(order.bookings || []),
            ...(order.items || []).map((item: any) => item.booking),
            ...backLinked.map((b) => b._id),
          ]
            .filter(Boolean)
            .map((id: any) => [String(id), id])
        ).values(),
      ];

      // Deleting a booking removes its date reservation but would strand the
      // units it holds in `availableStock`, so hand them back first.
      await releaseBookingStock(bookingIds, session);

      const byBooking = bookingIds.length ? [{ booking: { $in: bookingIds } }] : [];

      const payments = await Payment.deleteMany({
        $or: [
          { order: order._id },
          ...byBooking,
          ...(bookingIds.length ? [{ bookingId: { $in: bookingIds } }] : []),
        ],
      }).session(session);

      const deposits = await SecurityDeposit.deleteMany({
        $or: [{ order: order._id }, ...byBooking],
      }).session(session);

      const invoices = await Invoice.deleteMany({ orderId: order._id }).session(session);

      const bookings = bookingIds.length
        ? await Booking.deleteMany({ _id: { $in: bookingIds } }).session(session)
        : { deletedCount: 0 };

      await Order.deleteOne({ _id: order._id }).session(session);

      return {
        ok: true as const,
        status: 200,
        data: {
          orderNumber: order.orderNumber,
          deleted: {
            orders: 1,
            bookings: bookings.deletedCount || 0,
            payments: payments.deletedCount || 0,
            securityDeposits: deposits.deletedCount || 0,
            invoices: invoices.deletedCount || 0,
          },
        },
      };
    });

    return result;
  } catch (error: any) {
    console.error('deleteOrder error:', error);
    return { ok: false as const, status: 500, error: error?.message || 'Failed to delete order' };
  } finally {
    session.endSession();
  }
}

/**
 * Approves an order that is waiting on a decision, moving it into fulfilment.
 *
 * Refuses orders still awaiting an online payment — approving one would ship
 * goods against money the gateway never confirmed.
 */
export async function approveOrder(orderId: string, adminEmail?: string) {
  await connectToDatabase();

  const denied = await assertOwnsOrder(orderId, adminEmail);
  if (denied) return denied;

  const order = await Order.findById(orderId);
  if (!order) return { ok: false as const, status: 404, error: 'Order not found' };

  if (order.paymentProvider === 'cashfree' && order.paymentStatus !== 'paid') {
    return {
      ok: false as const,
      status: 400,
      error: 'This order is still awaiting its online payment. Confirm the payment before approving.',
    };
  }

  order.status = 'confirmed';
  order.confirmationAt = order.confirmationAt || new Date();
  await order.save();

  const bookings = await Booking.find({ order: order._id });
  for (const booking of bookings) {
    if (['draft', 'pending_payment'].includes(booking.status)) {
      booking.status = booking.deliveryMethod === 'delivery' ? 'out_for_delivery' : 'ready_for_pickup';
      await booking.save();
    }
  }

  // Approval commits the order to fulfilment, so its units leave the shelf now
  // rather than at handover. No-op for lines already deducted at checkout.
  await holdBookingStock(bookings.map((booking) => booking._id));

  return { ok: true as const, status: 200, data: { orderNumber: order.orderNumber } };
}

/** Cancels every booking on an order, releasing the reserved stock. */
export async function cancelOrder(orderId: string, adminEmail?: string) {
  await connectToDatabase();

  const denied = await assertOwnsOrder(orderId, adminEmail);
  if (denied) return denied;

  const order = await Order.findById(orderId);
  if (!order) return { ok: false as const, status: 404, error: 'Order not found' };

  const bookings = await Booking.find({ order: order._id }).select('_id status');
  const results = [];
  for (const booking of bookings) {
    if (['completed', 'cancelled'].includes(booking.status)) continue;
    results.push(await updateBookingLifecycle({ bookingId: String(booking._id), action: 'cancel' }));
  }

  const failed = results.find((r: any) => !r.ok);
  if (failed) return failed;

  return { ok: true as const, status: 200, data: { orderNumber: order.orderNumber, cancelled: results.length } };
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
