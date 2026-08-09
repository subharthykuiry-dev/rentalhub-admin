// lib/services/paymentService.ts
//
// Sales, receivables and payment-mix reporting for the admin.
//
// Since the customer app moved to real payment modes, an order is no longer
// "paid" the moment it is created: an online order is paid only after Cashfree
// confirms it, and a COD order is paid only once cash is collected at handover.
// Revenue therefore has to be split into money *collected* and money *owed*.

import mongoose from 'mongoose';
import connectToDatabase from '@/config/db';
import Booking from '@/models/Booking';
import Order from '@/models/Order';
import Payment from '@/models/Payment';
import Product from '@/models/Product';
import User from '@/models/User';
import { markOrderPaid, serializeOrderDoc } from '@/lib/rental-service';

/**
 * Ids of the products a given admin published.
 *
 * Every seller-facing figure is scoped through this: an admin must only ever
 * see rentals, revenue and customer details for their own catalogue. Passing
 * no email means "no scoping" and is reserved for internal/global callers.
 */
export async function getAdminProductIds(adminEmail?: string) {
  if (!adminEmail) return null;
  await connectToDatabase();
  const products = await Product.find({ publishedBy: adminEmail }).select('_id').lean<any[]>();
  return products.map((p) => p._id as mongoose.Types.ObjectId);
}

/**
 * Order ids that contain at least one rental line from this admin's catalogue.
 * An order can span several sellers, so ownership is decided per rental line.
 */
async function adminOrderIds(adminEmail?: string) {
  const productIds = await getAdminProductIds(adminEmail);
  if (!productIds) return null;
  if (productIds.length === 0) return [];

  const ids = await Booking.distinct('order', { product: { $in: productIds } });
  return ids.filter(Boolean) as mongoose.Types.ObjectId[];
}

const PAID = 'paid';

/**
 * Reporting timezone. The server runs in UTC on Vercel, so "today" and the
 * daily buckets must be computed against the business's own clock or an
 * evening order in India lands on the previous day's figures.
 */
const REPORT_TZ = process.env.REPORT_TIMEZONE || 'Asia/Kolkata';

/** YYYY-MM-DD in the reporting timezone (en-CA formats exactly that way). */
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dayKey(date: Date) {
  return dayKeyFormatter.format(date);
}

/** Milliseconds to add to a UTC instant to get the reporting zone's wall time. */
function tzOffsetMs(at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  // `hour` comes back as 24 at midnight under hour12:false in some runtimes.
  const hour = get('hour') % 24;
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asIfUtc - at.getTime();
}

/** The UTC instant at which the given day starts in the reporting timezone. */
function startOfDay(at = new Date()) {
  const offset = tzOffsetMs(at);
  const wall = new Date(at.getTime() + offset);
  const wallMidnight = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  return new Date(wallMidnight - offset);
}

function startOfMonth(at = new Date()) {
  const offset = tzOffsetMs(at);
  const wall = new Date(at.getTime() + offset);
  const wallFirst = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1);
  return new Date(wallFirst - offset);
}

/** Sums `totalAmount` over orders matching a filter, optionally seller-scoped. */
async function sumOrders(match: Record<string, unknown>, orderIds: mongoose.Types.ObjectId[] | null) {
  const scoped = orderIds ? { ...match, _id: { $in: orderIds } } : match;
  const agg = await Order.aggregate([
    { $match: scoped },
    { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
  ]);
  return { total: agg[0]?.total ?? 0, count: agg[0]?.count ?? 0 };
}

/**
 * Seller-attributable rental revenue, summed from this admin's own booking
 * lines rather than the order total.
 *
 * Order totals include marketplace-level tax and delivery, and in a
 * multi-seller order they cover other sellers' items too — so using them per
 * seller would overstate revenue.
 */
async function sumOwnLines(productIds: mongoose.Types.ObjectId[]) {
  const rows = await Booking.aggregate([
    { $match: { product: { $in: productIds } } },
    { $lookup: { from: 'orders', localField: 'order', foreignField: '_id', as: 'ord' } },
    { $unwind: '$ord' },
    {
      $group: {
        _id: { status: '$ord.paymentStatus', provider: '$ord.paymentProvider' },
        rental: { $sum: '$rentalAmount' },
        deposit: { $sum: '$securityDeposit' },
        orders: { $addToSet: '$order' },
      },
    },
  ]);

  const pick = (fn: (r: any) => boolean) => {
    const matched = rows.filter((r) => fn(r._id));
    const orderSet = new Set<string>();
    matched.forEach((r) => r.orders.forEach((o: any) => orderSet.add(String(o))));
    return {
      total: matched.reduce((s, r) => s + r.rental, 0),
      deposit: matched.reduce((s, r) => s + r.deposit, 0),
      count: orderSet.size,
    };
  };

  return { pick };
}

/**
 * Headline sales figures. `collected` is real money in; `outstanding` is what
 * customers still owe (COD awaiting handover + online awaiting confirmation).
 */
export async function getSalesSummary(adminEmail?: string) {
  await connectToDatabase();

  const today = startOfDay();
  const monthStart = startOfMonth();
  const orderIds = await adminOrderIds(adminEmail);

  // A seller with no products has no sales; return zeros rather than falling
  // through to an unscoped query that would expose the whole marketplace.
  if (orderIds && orderIds.length === 0) return emptySummary();

  const [
    collected,
    outstandingCod,
    awaitingOnline,
    failed,
    refunded,
    collectedToday,
    collectedThisMonth,
    codOrders,
    onlineOrders,
  ] = await Promise.all([
    sumOrders({ paymentStatus: PAID }, orderIds),
    sumOrders({ paymentStatus: 'pending', paymentProvider: 'cod' }, orderIds),
    sumOrders({ paymentStatus: 'pending', paymentProvider: 'cashfree' }, orderIds),
    sumOrders({ paymentStatus: 'failed' }, orderIds),
    sumOrders({ paymentStatus: { $in: ['refunded', 'partially_refunded'] } }, orderIds),
    sumOrders({ paymentStatus: PAID, confirmationAt: { $gte: today } }, orderIds),
    sumOrders({ paymentStatus: PAID, confirmationAt: { $gte: monthStart } }, orderIds),
    sumOrders({ paymentProvider: 'cod' }, orderIds),
    sumOrders({ paymentProvider: 'cashfree' }, orderIds),
  ]);

  const gross = collected.total + outstandingCod.total + awaitingOnline.total;

  return {
    collectedAmount: collected.total,
    collectedOrders: collected.count,

    // Cash the courier still has to bring back.
    codDueAmount: outstandingCod.total,
    codDueOrders: outstandingCod.count,

    // Started a gateway payment but never confirmed — usually abandoned carts.
    awaitingOnlineAmount: awaitingOnline.total,
    awaitingOnlineOrders: awaitingOnline.count,

    outstandingAmount: outstandingCod.total + awaitingOnline.total,
    outstandingOrders: outstandingCod.count + awaitingOnline.count,

    failedAmount: failed.total,
    failedOrders: failed.count,
    refundedAmount: refunded.total,

    collectedToday: collectedToday.total,
    ordersToday: collectedToday.count,
    collectedThisMonth: collectedThisMonth.total,

    codOrders: codOrders.count,
    onlineOrders: onlineOrders.count,
    grossBooked: gross,
    collectionRate: gross > 0 ? Math.round((collected.total / gross) * 100) : 0,
  };
}

function emptySummary() {
  return {
    collectedAmount: 0, collectedOrders: 0,
    codDueAmount: 0, codDueOrders: 0,
    awaitingOnlineAmount: 0, awaitingOnlineOrders: 0,
    outstandingAmount: 0, outstandingOrders: 0,
    failedAmount: 0, failedOrders: 0, refundedAmount: 0,
    collectedToday: 0, ordersToday: 0, collectedThisMonth: 0,
    codOrders: 0, onlineOrders: 0, grossBooked: 0, collectionRate: 0,
  };
}

/** Daily collected-vs-booked series for the last `days` days. */
export async function getSalesTrend(days = 14, adminEmail?: string) {
  await connectToDatabase();
  const from = startOfDay(new Date(Date.now() - (days - 1) * 86400000));

  const orderIds = await adminOrderIds(adminEmail);
  const match: Record<string, unknown> = { createdAt: { $gte: from } };
  if (orderIds) {
    if (orderIds.length === 0) {
      return Array.from({ length: days }, (_, i) => ({
        date: dayKey(new Date(from.getTime() + i * 86400000)),
        booked: 0, collected: 0, orders: 0,
      }));
    }
    match._id = { $in: orderIds };
  }

  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: REPORT_TZ } },
        booked: { $sum: '$totalAmount' },
        collected: { $sum: { $cond: [{ $eq: ['$paymentStatus', PAID] }, '$totalAmount', 0] } },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill gaps so the chart has one point per day. Keys are generated in the
  // same timezone the aggregation grouped by, or nothing would ever match.
  const byDate = new Map(rows.map((r: any) => [r._id, r]));
  const series: Array<{ date: string; booked: number; collected: number; orders: number }> = [];
  for (let i = 0; i < days; i++) {
    const key = dayKey(new Date(from.getTime() + i * 86400000));
    const row: any = byDate.get(key);
    series.push({ date: key, booked: row?.booked ?? 0, collected: row?.collected ?? 0, orders: row?.orders ?? 0 });
  }
  return series;
}

export type InvoiceFilter = 'all' | 'pending' | 'paid' | 'failed' | 'cod' | 'online';

/** Invoice/receivables ledger — one row per order, newest first. */
export async function listInvoices(filter: InvoiceFilter = 'all', search = '', adminEmail?: string) {
  await connectToDatabase();

  const orderIds = await adminOrderIds(adminEmail);
  if (orderIds && orderIds.length === 0) return [];

  const where: Record<string, unknown> = {};
  if (orderIds) where._id = { $in: orderIds };
  if (filter === 'pending') where.paymentStatus = 'pending';
  else if (filter === 'paid') where.paymentStatus = PAID;
  else if (filter === 'failed') where.paymentStatus = 'failed';
  else if (filter === 'cod') where.paymentProvider = 'cod';
  else if (filter === 'online') where.paymentProvider = 'cashfree';

  if (search) {
    const users = await User.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ],
    }).select('_id');
    where.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { user: { $in: users.map((u) => u._id) } },
    ];
  }

  const orders = await Order.find(where)
    .populate('user', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(200);

  return orders.map((order: any) => {
    const o = serializeOrderDoc(order);
    return {
      ...o,
      customerName: order.user?.name ?? 'Unknown',
      customerEmail: order.user?.email ?? '',
      customerPhone: order.user?.phone ?? '',
      // What the business is still owed on this order.
      amountDue: order.paymentStatus === PAID ? 0 : order.totalAmount,
      isCod: order.paymentProvider === 'cod',
    };
  });
}

/**
 * Marks a COD order as collected at handover.
 *
 * Refuses non-COD orders: an online order must be settled by the gateway
 * confirmation, never by hand, or the ledger would claim money that the
 * payment processor never actually received.
 */
export async function markCodCollected(orderId: string, collectedBy?: string, adminEmail?: string) {
  await connectToDatabase();

  const order = await Order.findById(orderId).select('paymentProvider paymentStatus');
  if (!order) return { ok: false as const, status: 404, error: 'Order not found' };

  // An admin may only settle an order that includes one of their own products.
  const ownIds = await adminOrderIds(adminEmail);
  if (ownIds && !ownIds.some((id) => String(id) === String(order._id))) {
    return { ok: false as const, status: 403, error: 'This order belongs to another seller.' };
  }

  if (order.paymentProvider !== 'cod') {
    return {
      ok: false as const,
      status: 400,
      error: 'Only cash-on-delivery orders can be marked collected. Online payments settle via the gateway.',
    };
  }

  if (order.paymentStatus === PAID) {
    return { ok: false as const, status: 409, error: 'This order is already marked paid.' };
  }

  return markOrderPaid({ orderId, paymentMethod: 'cod', collectedBy });
}

/** Per-customer rollup: lifetime spend, outstanding dues and order counts. */
export async function listCustomers(search = '', adminEmail?: string) {
  await connectToDatabase();

  const orderIds = await adminOrderIds(adminEmail);
  if (orderIds && orderIds.length === 0) return [];

  const rows = await Order.aggregate([
    ...(orderIds ? [{ $match: { _id: { $in: orderIds } } }] : []),
    {
      $group: {
        _id: '$user',
        orders: { $sum: 1 },
        lifetimeValue: { $sum: { $cond: [{ $eq: ['$paymentStatus', PAID] }, '$totalAmount', 0] } },
        outstanding: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, '$totalAmount', 0] } },
        pendingOrders: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] } },
        codOrders: { $sum: { $cond: [{ $eq: ['$paymentProvider', 'cod'] }, 1, 0] } },
        onlineOrders: { $sum: { $cond: [{ $eq: ['$paymentProvider', 'cashfree'] }, 1, 0] } },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
    { $sort: { lifetimeValue: -1 } },
    { $limit: 200 },
  ]);

  const users = await User.find({ _id: { $in: rows.map((r: any) => r._id) } })
    .select('name email phone createdAt')
    .lean<any[]>();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const merged = rows.map((r: any) => {
    const u = byId.get(String(r._id));
    return {
      id: String(r._id),
      name: u?.name ?? 'Unknown',
      email: u?.email ?? '',
      phone: u?.phone ? String(u.phone) : '',
      joinedAt: u?.createdAt ?? null,
      orders: r.orders,
      lifetimeValue: r.lifetimeValue,
      outstanding: r.outstanding,
      pendingOrders: r.pendingOrders,
      codOrders: r.codOrders,
      onlineOrders: r.onlineOrders,
      lastOrderAt: r.lastOrderAt,
    };
  });

  if (!search) return merged;
  const q = search.toLowerCase();
  return merged.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
}

/** Recent payment ledger entries, for auditing what the gateway reported. */
export async function listPaymentLedger(limit = 50, adminEmail?: string) {
  await connectToDatabase();

  const orderIds = await adminOrderIds(adminEmail);
  if (orderIds && orderIds.length === 0) return [];

  const payments = await Payment.find(orderIds ? { order: { $in: orderIds } } : {})
    .populate('user', 'name email')
    .populate('order', 'orderNumber paymentProvider')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<any[]>();

  return payments.map((p: any) => ({
    id: String(p._id),
    purpose: p.purpose,
    provider: p.provider,
    method: p.method,
    status: p.status,
    amount: p.amount,
    reference: p.gatewayReference,
    customerName: p.user?.name ?? 'Unknown',
    orderNumber: p.order?.orderNumber ?? '—',
    processedAt: p.processedAt ?? null,
    createdAt: p.createdAt,
  }));
}
