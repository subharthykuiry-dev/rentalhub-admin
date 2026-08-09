// lib/services/dashboardService.ts
import connectToDatabase from '@/config/db';
import Booking from '@/models/Booking';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { markOverdueBookings } from '@/lib/rental-service';

const PENDING_PICKUP = ['confirmed', 'ready_for_pickup', 'out_for_delivery'] as const;

/**
 * Dashboard KPIs, computed against the unified Booking/Order collections that
 * the customer app writes to — so online and walk-in rentals both count.
 */
export async function getDashboardStats() {
  await connectToDatabase();
  await markOverdueBookings();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const sum = (field: string, match: Record<string, unknown>) =>
    Booking.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` } } }]);

  const [
    activeRentals,
    dueToday,
    upcomingPickups,
    upcomingReturns,
    overdueRentals,
    revenueAgg,
    depositsHeldAgg,
    lateFeeAgg,
    damageAgg,
    refundedAgg,
    totalProducts,
    outOfStock,
  ] = await Promise.all([
    Booking.countDocuments({ status: 'active' }),
    Booking.countDocuments({
      status: { $in: ['active', 'overdue'] },
      expectedReturnAt: { $gte: startOfToday, $lt: endOfToday },
    }),
    Booking.countDocuments({
      status: { $in: ['confirmed', 'ready_for_pickup', 'out_for_delivery'] },
      rentalStartAt: { $gte: now },
    }),
    Booking.countDocuments({ status: 'active', expectedReturnAt: { $gte: endOfToday } }),
    Booking.countDocuments({ status: 'overdue' }),

    sum('rentalAmount', { paymentStatus: 'paid' }),
    sum('securityDeposit', { depositHeldStatus: 'held' }),
    sum('lateFees', { lateFees: { $gt: 0 } }),
    sum('damageCharge', { damageCharge: { $gt: 0 } }),
    sum('depositRefundAmount', { depositRefundAmount: { $gt: 0 } }),

    Product.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true, availableStock: { $lte: 0 } }),
  ]);

  const [ordersToday, totalOrders] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: startOfToday, $lt: endOfToday } }),
    Order.countDocuments({}),
  ]);

  return {
    activeRentals,
    dueToday,
    upcomingPickups,
    upcomingReturns,
    overdueRentals,
    revenue: revenueAgg[0]?.total ?? 0,
    depositsHeld: depositsHeldAgg[0]?.total ?? 0,
    lateFeeCollected: lateFeeAgg[0]?.total ?? 0,
    damageCollected: damageAgg[0]?.total ?? 0,
    depositsRefunded: refundedAgg[0]?.total ?? 0,
    totalProducts,
    outOfStock,
    ordersToday,
    totalOrders,
  };
}

/** Items in customer custody that are due back, soonest first. */
export async function getReturnSchedule(limit = 10) {
  await connectToDatabase();
  const bookings = await Booking.find({ status: { $in: ['active', 'overdue'] } })
    .populate('user', 'name email phone')
    .populate({ path: 'product', select: 'name imageUrl' })
    .sort({ expectedReturnAt: 1 })
    .limit(limit);

  return bookings.map((b: any) => ({
    id: b._id.toString(),
    customerName: b.user?.name ?? 'Unknown',
    productName: b.product?.name ?? 'Unknown',
    expectedReturnAt: b.expectedReturnAt,
    status: b.status,
    overdue: b.status === 'overdue',
  }));
}

/** Confirmed bookings waiting to be handed over, soonest first. */
export async function getPickupSchedule(limit = 10) {
  await connectToDatabase();
  const bookings = await Booking.find({ status: { $in: [...PENDING_PICKUP] } })
    .populate('user', 'name email phone')
    .populate({ path: 'product', select: 'name imageUrl' })
    .sort({ rentalStartAt: 1 })
    .limit(limit);

  return bookings.map((b: any) => ({
    id: b._id.toString(),
    customerName: b.user?.name ?? 'Unknown',
    productName: b.product?.name ?? 'Unknown',
    rentalStartAt: b.rentalStartAt,
    deliveryMethod: b.deliveryMethod,
    status: b.status,
  }));
}
