import mongoose from 'mongoose';
import connectToDatabase from '@/config/db';
import Booking, { type IBooking } from '@/models/Booking';
import Order from '@/models/Order';
import Payment from '@/models/Payment';
import Product from '@/models/Product';
import SecurityDeposit from '@/models/SecurityDeposit';
import User from '@/models/User';
import { buildAddressSnapshot, calculateDepositSettlement, calculateLateFeeBreakdown, calculateRentalBreakdown, generateOrderNumber, generatePaymentReference, parseDateTime } from '@/lib/rental';

const ACTIVE_BOOKING_STATUSES = [
  'draft',
  'pending_payment',
  'confirmed',
  'ready_for_pickup',
  'out_for_delivery',
  'active',
  'overdue',
] as const;

const RETURNABLE_STATUSES = ['active', 'overdue'] as const;
const CANCELLABLE_STATUSES = ['draft', 'pending_payment', 'confirmed', 'ready_for_pickup', 'out_for_delivery'] as const;

/**
 * STOCK ACCOUNTING
 *
 * `product.availableStock` counts units that are free to rent out. A unit stops
 * being free the moment its order is committed to fulfilment — COD/walk-in at
 * creation, online at payment confirmation, admin-held orders at approval — and
 * stays unavailable until the return is settled or the order is cancelled.
 * Pickup is a physical handover, not a stock event.
 *
 * Both helpers key off `booking.stockDeducted` so they are safe to call more
 * than once: a replayed gateway webhook cannot double-deduct, and a booking
 * that went overdue without ever being picked up cannot inflate stock on
 * return. Neither saves the booking — callers persist it alongside their own
 * changes, inside the caller's transaction.
 */
async function deductProductStock(booking: IBooking, session?: mongoose.ClientSession | null) {
  if (booking.stockDeducted) return;

  const product = await Product.findById(booking.product).session(session ?? null);
  if (!product) return;

  product.availableStock = Math.max(0, (product.availableStock ?? product.totalStock ?? 0) - booking.quantity);
  await product.save({ session: session ?? undefined });
  booking.stockDeducted = true;
}

async function restoreProductStock(booking: IBooking, session?: mongoose.ClientSession | null) {
  if (!booking.stockDeducted) return;

  const product = await Product.findById(booking.product).session(session ?? null);
  if (!product) return;

  product.availableStock = Math.min(product.totalStock, (product.availableStock || 0) + booking.quantity);
  await product.save({ session: session ?? undefined });
  booking.stockDeducted = false;
}

/**
 * Takes units off the shelf for bookings committed outside the checkout and
 * payment flows — an admin approving a held order. Persists each booking, since
 * the caller has no other reason to save it.
 */
export async function holdBookingStock(
  bookingIds: mongoose.Types.ObjectId[] | string[],
  session?: mongoose.ClientSession | null
) {
  if (!bookingIds.length) return;

  const bookings = await Booking.find({ _id: { $in: bookingIds }, stockDeducted: false }).session(session ?? null);
  for (const booking of bookings) {
    await deductProductStock(booking, session);
    await booking.save({ session: session ?? undefined });
  }
}

/**
 * Returns held units to the shelf for bookings that are about to disappear or
 * be closed outside the normal lifecycle (order deletion, bulk cancellation).
 * Persists each booking, since the caller has no other reason to save it.
 */
export async function releaseBookingStock(
  bookingIds: mongoose.Types.ObjectId[] | string[],
  session?: mongoose.ClientSession | null
) {
  if (!bookingIds.length) return;

  const bookings = await Booking.find({ _id: { $in: bookingIds }, stockDeducted: true }).session(session ?? null);
  for (const booking of bookings) {
    await restoreProductStock(booking, session);
    await booking.save({ session: session ?? undefined });
  }
}

function serializeAddressSnapshot(address: any) {
  if (!address) return undefined;
  return {
    id: address.id || address._id?.toString?.(),
    label: address.label,
    street: address.street,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    country: address.country,
  };
}

export function serializeBookingDoc(bookingDoc: any) {
  if (!bookingDoc) return null;
  const booking = bookingDoc.toJSON ? bookingDoc.toJSON() : bookingDoc;
  booking.id = booking._id?.toString?.() || booking.id;
  booking.userId = booking.user?.toString?.() || booking.userId;
  booking.orderId = booking.order?._id?.toString?.() || booking.order?.toString?.() || booking.orderId;
  booking.paymentId = booking.payment?._id?.toString?.() || booking.payment?.toString?.() || booking.paymentId;
  booking.securityDepositRecordId = booking.securityDepositRecord?._id?.toString?.() || booking.securityDepositRecord?.toString?.() || booking.securityDepositRecordId;
  booking.productId = booking.product?._id?.toString?.() || booking.product?.toString?.() || booking.productId;
  booking.deliveryAddressSnapshot = serializeAddressSnapshot(booking.deliveryAddressSnapshot);
  // Only stamp `.id` onto genuinely populated documents. An ObjectId's `_id`
  // getter returns itself, so an unpopulated ref would pass a truthy `._id`
  // check — and `ObjectId.id` is a settable property backing the instance's
  // internal buffer, so assigning a hex string to it corrupts the ObjectId and
  // makes any later JSON.stringify throw a BSONError.
  if (isPopulatedDoc(booking.product)) {
    booking.product.id = String(booking.product._id);
    if (isPopulatedDoc(booking.product.category)) {
      booking.product.category.id = String(booking.product.category._id);
    }
  }
  return booking;
}

/**
 * Converts a mongoose document into a JSON-safe plain object, turning every
 * ObjectId into a string so the result can cross an HTTP boundary.
 */
export function toPlainDoc(doc: any) {
  if (!doc) return doc;
  const plain = doc.toObject
    ? doc.toObject({ flattenObjectIds: true, versionKey: false })
    : doc;
  if (plain._id) plain.id = String(plain._id);
  return plain;
}

/** True only for a populated sub-document, never for a bare ObjectId ref. */
function isPopulatedDoc(value: any): boolean {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    value._bsontype !== 'ObjectId' &&
    !(value instanceof mongoose.Types.ObjectId) &&
    value._id != null
  );
}

export function serializeOrderDoc(orderDoc: any) {
  if (!orderDoc) return null;
  const order = orderDoc.toJSON ? orderDoc.toJSON() : orderDoc;
  order.id = order._id?.toString?.() || order.id;
  order.userId = order.user?.toString?.() || order.userId;
  order.bookings = (order.bookings || []).map((booking: any) =>
    booking?._id?.toString?.() || booking?.toString?.() || booking
  );
  order.deliveryAddressSnapshot = serializeAddressSnapshot(order.deliveryAddressSnapshot);
  order.items = (order.items || []).map((item: any) => {
    const mapped = { ...item };
    mapped.id = item._id?.toString?.() || item.id;
    mapped.bookingId = item.booking?._id?.toString?.() || item.booking?.toString?.() || item.bookingId;
    mapped.productId = item.product?._id?.toString?.() || item.product?.toString?.() || item.productId;
    return mapped;
  });
  return order;
}

async function refreshOrderAggregates(orderId: mongoose.Types.ObjectId, session: mongoose.ClientSession) {
  const order = await Order.findById(orderId).session(session);
  if (!order) return null;

  const bookings = await Booking.find({ order: orderId }).session(session);
  const allCancelled = bookings.length > 0 && bookings.every((booking) => booking.status === 'cancelled');
  const allClosed = bookings.length > 0 && bookings.every((booking) => ['completed', 'cancelled'].includes(booking.status));
  const anyOverdue = bookings.some((booking) => booking.status === 'overdue' || booking.overdue);

  order.securityDepositRefundTotal = bookings.reduce((sum, booking) => sum + (booking.depositRefundAmount || 0), 0);
  order.securityDepositDeductedTotal = bookings.reduce((sum, booking) => sum + (booking.depositDeductedAmount || 0), 0);
  order.lateFeeTotal = bookings.reduce((sum, booking) => sum + (booking.lateFees || 0), 0);
  order.refundTotal = order.securityDepositRefundTotal;
  order.paymentStatus = allCancelled
    ? 'refunded'
    : order.securityDepositRefundTotal > 0 || order.securityDepositDeductedTotal > 0 || order.lateFeeTotal > 0
      ? 'partially_refunded'
      : order.paymentStatus;
  order.status = allCancelled ? 'cancelled' : anyOverdue ? 'overdue' : allClosed ? 'completed' : order.status;
  if (allClosed) {
    order.completedAt = new Date();
  }

  await order.save({ session });
  return order;
}

export async function getProductAvailability(params: {
  productId: string;
  rentalStart: string | Date;
  rentalEnd: string | Date;
  quantity?: number;
  excludeBookingId?: string;
}) {
  await connectToDatabase();

  const [product, start, end] = await Promise.all([
    Product.findById(params.productId),
    Promise.resolve(parseDateTime(params.rentalStart)),
    Promise.resolve(parseDateTime(params.rentalEnd)),
  ]);

  if (!product) {
    return {
      ok: false as const,
      status: 404,
      error: 'Product not found',
    };
  }

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return {
      ok: false as const,
      status: 400,
      error: 'Invalid rental period',
    };
  }

  const quantity = Math.max(1, params.quantity ?? 1);
  const now = new Date();

  const overlapFilter: Record<string, unknown> = {
    product: product._id,
    status: { $in: [...ACTIVE_BOOKING_STATUSES] },
    rentalStartAt: { $lte: end },
    expectedReturnAt: { $gte: start },
  };

  if (params.excludeBookingId) {
    overlapFilter._id = { $ne: params.excludeBookingId };
  }

  const [overlappingQuantityAgg, overlappingBookings] = await Promise.all([
    Booking.aggregate([
      { $match: overlapFilter },
      {
        $group: {
          _id: '$product',
          quantity: { $sum: '$quantity' },
        },
      },
    ]),
    Booking.find({
      ...overlapFilter,
      $or: [
        { reservationExpiresAt: { $exists: false } },
        { reservationExpiresAt: null },
        { reservationExpiresAt: { $gt: now } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('status quantity rentalStartAt expectedReturnAt reservationExpiresAt'),
  ]);

  const reservedQuantity = overlappingQuantityAgg[0]?.quantity || 0;
  const availableQuantity = Math.max(0, (product.totalStock || 0) - reservedQuantity);

  return {
    ok: true as const,
    status: 200,
    data: {
      product,
      availableQuantity,
      requestedQuantity: quantity,
      isAvailable: quantity <= availableQuantity,
      isLimited: availableQuantity <= 5,
      reservedQuantity,
      conflictingBookings: overlappingBookings.map((booking) => ({
        id: booking._id.toString(),
        status: booking.status,
        quantity: booking.quantity,
        rentalStartAt: booking.rentalStartAt,
        expectedReturnAt: booking.expectedReturnAt,
      })),
      requestedRange: {
        start,
        end,
      },
    },
  };
}

export async function validateRentalItems(params: {
  items: Array<{
    productId: string;
    quantity: number;
    rentalStart: string | Date;
    rentalEnd: string | Date;
  }>;
}) {
  const validations = [];
  for (const item of params.items) {
    const result = await getProductAvailability({
      productId: item.productId,
      rentalStart: item.rentalStart,
      rentalEnd: item.rentalEnd,
      quantity: item.quantity,
    });
    if (!result.ok) {
      return result;
    }

    validations.push({
      ...result.data,
      item,
      breakdown: calculateRentalBreakdown({
        dailyPrice: result.data.product.dailyPrice,
        weeklyPrice: result.data.product.weeklyPrice,
        monthlyPrice: result.data.product.monthlyPrice,
        rentalStartAt: item.rentalStart,
        expectedReturnAt: item.rentalEnd,
        quantity: item.quantity,
      }),
    });
  }

  return {
    ok: true as const,
    status: 200,
    data: validations,
  };
}

async function loadDeliveryAddress(userId: string, deliveryAddressId?: string | null) {
  if (!deliveryAddressId) return undefined;

  const user = await User.findById(userId).select('addresses');
  if (!user) return undefined;

  const addresses = user.addresses as any;
  const address = addresses.id(deliveryAddressId) || addresses.find((entry: any) => entry._id?.toString() === deliveryAddressId);
  if (!address) return undefined;

  return buildAddressSnapshot({
    id: address._id?.toString?.(),
    label: address.label,
    street: address.street,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    country: address.country,
  });
}

export async function createBookingDrafts(params: {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    rentalStart: string | Date;
    rentalEnd: string | Date;
  }>;
  deliveryMethod: 'delivery' | 'pickup';
  deliveryAddressId?: string | null;
}) {
  await connectToDatabase();

  const validation = await validateRentalItems({ items: params.items });
  if (!validation.ok) return validation;

  const deliveryAddressSnapshot =
    params.deliveryMethod === 'delivery'
      ? await loadDeliveryAddress(params.userId, params.deliveryAddressId)
      : undefined;

  if (params.deliveryMethod === 'delivery' && !deliveryAddressSnapshot) {
    return {
      ok: false as const,
      status: 400,
      error: 'Delivery address is required for delivery bookings',
    };
  }

  const reservationExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const bookings = [] as any[];

  for (const entry of validation.data) {
    const start = parseDateTime(entry.item.rentalStart)!;
    const end = parseDateTime(entry.item.rentalEnd)!;
    const booking = await Booking.create({
      user: params.userId,
      product: entry.product._id,
      quantity: entry.item.quantity,
      rentalStart: start,
      rentalEnd: end,
      rentalStartAt: start,
      expectedReturnAt: end,
      rentalMinutes: entry.breakdown.rentalMinutes,
      rentalDays: entry.breakdown.billingDays,
      pricePerDay: entry.breakdown.pricePerDay,
      rentalAmount: entry.breakdown.rentalAmount,
      securityDeposit: entry.product.securityDeposit * entry.item.quantity,
      totalAmount: entry.breakdown.rentalAmount + entry.product.securityDeposit * entry.item.quantity,
      deliveryMethod: params.deliveryMethod,
      deliveryAddressId: params.deliveryMethod === 'delivery' ? params.deliveryAddressId || undefined : undefined,
      deliveryAddressSnapshot,
      pickupLocation: params.deliveryMethod === 'pickup' ? 'RentalHub Store' : undefined,
      pickupScheduledAt: start,
      pickupConfirmationStatus: 'pending',
      returnConfirmationStatus: 'pending',
      returnStatus: 'pending',
      status: 'pending_payment',
      paymentStatus: 'pending',
      paymentMethod: 'mock',
      depositPaymentStatus: 'pending',
      depositHeldStatus: 'pending',
      depositRefundStatus: 'pending',
      reservationExpiresAt,
      depositHistory: [],
    });

    bookings.push(serializeBookingDoc(booking));
  }

  return {
    ok: true as const,
    status: 201,
    data: bookings,
  };
}

export async function createRentalCheckoutOrder(params: {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    rentalStart: string | Date;
    rentalEnd: string | Date;
  }>;
  deliveryMethod: 'delivery' | 'pickup';
  deliveryAddressId?: string | null;
  paymentMethod: string;
  paymentMode?: 'cod' | 'online';
}) {
  await connectToDatabase();
  const session = await mongoose.startSession();

  // Online orders are created unpaid and parked in `pending_payment`; nothing
  // ships and no deposit is held until the gateway confirms the payment. COD
  // and walk-in orders are fulfilled straight away and collected on handover.
  const isOnline = params.paymentMode === 'online';
  const provider = isOnline ? 'cashfree' : 'cod';
  const fulfilmentStatus = params.deliveryMethod === 'delivery' ? 'out_for_delivery' : 'ready_for_pickup';
  const bookingStatus = isOnline ? 'pending_payment' : fulfilmentStatus;
  const depositState = isOnline ? 'pending' : 'held';

  try {
    const result = await session.withTransaction(async () => {
      const user = await User.findById(params.userId).session(session).select('name email phone profileImage addresses');
      if (!user) {
        return {
          ok: false as const,
          status: 404,
          error: 'User not found',
        };
      }

      const validation = await validateRentalItems({ items: params.items });
      if (!validation.ok) {
        return validation;
      }

      const deliveryAddressSnapshot =
        params.deliveryMethod === 'delivery'
          ? await loadDeliveryAddress(params.userId, params.deliveryAddressId)
          : undefined;

      if (params.deliveryMethod === 'delivery' && !deliveryAddressSnapshot) {
        return {
          ok: false as const,
          status: 400,
          error: 'Delivery address is required for delivery orders',
        };
      }

      const orderItems = [] as any[];
      const bookings: IBooking[] = [];
      let subtotal = 0;
      let securityDepositTotal = 0;

      for (const entry of validation.data) {
        const start = parseDateTime(entry.item.rentalStart)!;
        const end = parseDateTime(entry.item.rentalEnd)!;
        const product = entry.product;
        const breakdown = entry.breakdown;
        const booking = new Booking({
          user: params.userId,
          product: product._id,
          quantity: entry.item.quantity,
          rentalStart: start,
          rentalEnd: end,
          rentalStartAt: start,
          expectedReturnAt: end,
          rentalMinutes: breakdown.rentalMinutes,
          rentalDays: breakdown.billingDays,
          pricePerDay: breakdown.pricePerDay,
          rentalAmount: breakdown.rentalAmount,
          securityDeposit: product.securityDeposit * entry.item.quantity,
          totalAmount: breakdown.rentalAmount + product.securityDeposit * entry.item.quantity,
          deliveryMethod: params.deliveryMethod,
          deliveryAddressId: params.deliveryMethod === 'delivery' ? params.deliveryAddressId || undefined : undefined,
          deliveryAddressSnapshot,
          pickupLocation: params.deliveryMethod === 'pickup' ? 'RentalHub Store' : 'RentalHub Delivery Network',
          pickupScheduledAt: start,
          pickupConfirmationStatus: 'pending',
          returnConfirmationStatus: 'pending',
          returnStatus: 'pending',
          status: bookingStatus,
          paymentStatus: 'pending',
          paymentMethod: params.paymentMethod,
          depositPaymentStatus: depositState,
          depositHeldStatus: depositState,
          depositRefundStatus: 'pending',
          depositRefunded: false,
          depositHistory: isOnline ? [] : [
            {
              type: 'hold',
              amount: product.securityDeposit * entry.item.quantity,
              reason: 'Security deposit held at booking confirmation',
              reference: generatePaymentReference('DEP'),
              createdAt: new Date(),
            },
          ],
        });

        bookings.push(booking);
        subtotal += breakdown.rentalAmount;
        securityDepositTotal += product.securityDeposit * entry.item.quantity;
        orderItems.push({
          booking: booking._id,
          product: product._id,
          productName: product.name,
          quantity: entry.item.quantity,
          pricePerDay: breakdown.pricePerDay,
          rentalDays: breakdown.billingDays,
          rentalAmount: breakdown.rentalAmount,
          securityDeposit: product.securityDeposit * entry.item.quantity,
          deliveryMethod: params.deliveryMethod,
          rentalStartAt: start,
          expectedReturnAt: end,
        });
      }

      const deliveryFee = params.deliveryMethod === 'delivery' ? 99 : 0;
      const tax = Math.round(subtotal * 0.18);
      const totalAmount = subtotal + securityDepositTotal + deliveryFee + tax;
      const orderNumber = generateOrderNumber();
      const paymentReference = generatePaymentReference('ORD');

      const order = await Order.create(
        [
          {
            user: params.userId,
            orderNumber,
            invoiceNumber: orderNumber,
            bookings: bookings.map((booking) => booking._id),
            subtotal,
            securityDepositTotal,
            securityDepositRefundTotal: securityDepositTotal,
            securityDepositDeductedTotal: 0,
            lateFeeTotal: 0,
            refundTotal: 0,
            deliveryFee,
            tax,
            totalAmount,
            deliveryMethod: params.deliveryMethod,
            deliveryAddressId: params.deliveryMethod === 'delivery' ? params.deliveryAddressId || undefined : undefined,
            deliveryAddressSnapshot,
            paymentMethod: params.paymentMethod,
            paymentStatus: 'pending',
            paymentProvider: provider,
            paymentReference,
            paymentId: paymentReference,
            status: isOnline ? 'pending_payment' : 'confirmed',
            confirmationAt: isOnline ? undefined : new Date(),
            items: orderItems,
            invoiceUrl: `/orders/${orderNumber}`,
          },
        ],
        { session }
      );

      const orderDoc = order[0];
      orderDoc.invoiceUrl = `/orders/${orderDoc._id.toString()}`;
      await orderDoc.save({ session });

      const paymentRecords = [] as any[];
      const securityDepositRecords = [] as any[];

      for (const booking of bookings) {
        booking.order = orderDoc._id;
        booking.invoiceNumber = orderNumber;
        booking.paymentId = paymentReference;
        booking.paymentStatus = 'pending';
        booking.paymentMethod = params.paymentMethod;
        booking.depositPaymentStatus = depositState;
        booking.depositHeldStatus = depositState;
        booking.status = bookingStatus;
        booking.payment = undefined;
        booking.securityDepositRecord = undefined;
        // COD and walk-in orders are committed on creation, so their units come
        // off the shelf now. Online orders wait for markOrderPaid.
        if (!isOnline) {
          await deductProductStock(booking, session);
        }
        await booking.save({ session });

        const payment = await Payment.create(
          [
            {
              user: params.userId,
              order: orderDoc._id,
              booking: booking._id,
              bookingId: booking._id,
              purpose: 'rental_charge',
              provider,
              method: params.paymentMethod,
              status: 'pending',
              amount: booking.rentalAmount,
              currency: 'INR',
              gatewayReference: generatePaymentReference('PAY'),
              metadata: {
                rentalStartAt: booking.rentalStartAt,
                expectedReturnAt: booking.expectedReturnAt,
              },
              processedAt: isOnline ? undefined : new Date(),
            },
            {
              user: params.userId,
              order: orderDoc._id,
              booking: booking._id,
              bookingId: booking._id,
              purpose: 'security_deposit_hold',
              provider,
              method: params.paymentMethod,
              status: depositState,
              amount: booking.securityDeposit,
              currency: 'INR',
              gatewayReference: generatePaymentReference('DEP'),
              metadata: {
                securityDeposit: booking.securityDeposit,
              },
              processedAt: isOnline ? undefined : new Date(),
            },
          ] as any,
          // Mongoose refuses to create multiple documents inside a session
          // unless the insert is explicitly ordered.
          { session, ordered: true }
        );

        const [rentalPayment, depositPayment] = payment;

        booking.payment = rentalPayment._id;
        booking.securityDepositRecord = depositPayment._id;
        if (!isOnline) {
          booking.depositHistory.push({
            type: 'hold',
            amount: booking.securityDeposit,
            reason: 'Security deposit held during booking confirmation',
            reference: depositPayment.gatewayReference,
            createdAt: new Date(),
          });
        }
        await booking.save({ session });

        const depositRecord = await SecurityDeposit.create(
          [
            {
              user: params.userId,
              order: orderDoc._id,
              booking: booking._id,
              product: booking.product,
              amount: booking.securityDeposit,
              currency: 'INR',
              paymentStatus: depositState,
              holdStatus: depositState,
              refundStatus: 'pending',
              status: depositState,
              heldAmount: isOnline ? 0 : booking.securityDeposit,
              refundedAmount: 0,
              deductedAmount: 0,
              balanceDue: 0,
              heldAt: isOnline ? undefined : new Date(),
              transactions: isOnline ? [] : [
                {
                  type: 'hold',
                  amount: booking.securityDeposit,
                  reason: 'Security deposit held during booking confirmation',
                  reference: depositPayment.gatewayReference,
                  createdAt: new Date(),
                },
              ],
            },
          ] as any,
          { session, ordered: true }
        );

        booking.securityDepositRecord = depositRecord[0]._id;
        await booking.save({ session });

        paymentRecords.push(...payment);
        securityDepositRecords.push(...depositRecord);
      }

      return {
        ok: true as const,
        status: 201,
        data: {
          order: serializeOrderDoc(await Order.findById(orderDoc._id).populate('bookings').session(session)),
          bookings: bookings.map((booking) => serializeBookingDoc(booking)),
          // Raw mongoose documents cannot cross an HTTP boundary — serialising
          // their ObjectIds throws a BSON error after the order has committed.
          paymentRecords: paymentRecords.map(toPlainDoc),
          securityDepositRecords: securityDepositRecords.map(toPlainDoc),
        },
      };
    });

    return result;
  } catch (error: any) {
    console.error('createRentalCheckoutOrder error:', error);
    return {
      ok: false as const,
      status: 500,
      error: error?.message || 'Failed to create order',
    };
  } finally {
    session.endSession();
  }
}

/**
 * Promotes an order from unpaid to paid and holds its security deposits.
 *
 * Used for both an online gateway confirmation and an admin marking COD cash
 * as collected at handover. Idempotent — an order already paid is returned
 * untouched, so a webhook and a manual click cannot double-apply.
 */
export async function markOrderPaid(params: {
  orderId: string;
  gatewayPaymentId?: string;
  paymentMethod?: string;
  collectedBy?: string;
}) {
  await connectToDatabase();
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const order = await Order.findById(params.orderId).session(session);
      if (!order) {
        return { ok: false as const, status: 404, error: 'Order not found' };
      }

      if (order.paymentStatus === 'paid') {
        return {
          ok: true as const,
          status: 200,
          data: { alreadyPaid: true, order: serializeOrderDoc(order) },
        };
      }

      const now = new Date();

      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      order.confirmationAt = order.confirmationAt || now;
      if (params.gatewayPaymentId) order.paymentId = params.gatewayPaymentId;
      if (params.paymentMethod) order.paymentMethod = params.paymentMethod;
      if (params.collectedBy) {
        order.notes = `${order.notes ? order.notes + ' | ' : ''}COD collected by ${params.collectedBy} on ${now.toISOString()}`;
      }
      await order.save({ session });

      const bookings = await Booking.find({ order: order._id }).session(session);

      for (const booking of bookings) {
        booking.paymentStatus = 'paid';
        if (booking.status === 'pending_payment') {
          booking.status = booking.deliveryMethod === 'delivery' ? 'out_for_delivery' : 'ready_for_pickup';
        }
        await deductProductStock(booking, session);
        if (booking.depositHeldStatus !== 'held') {
          booking.depositPaymentStatus = 'held';
          booking.depositHeldStatus = 'held';
          booking.depositHistory.push({
            type: 'hold',
            amount: booking.securityDeposit,
            reason: 'Security deposit held on payment confirmation',
            reference: params.gatewayPaymentId || order.paymentReference || generatePaymentReference('DEP'),
            createdAt: now,
          });
        }
        await booking.save({ session });
      }

      await Payment.updateMany(
        { order: order._id, purpose: 'rental_charge' },
        { $set: { status: 'captured', processedAt: now } },
        { session }
      );

      await Payment.updateMany(
        { order: order._id, purpose: 'security_deposit_hold' },
        { $set: { status: 'held', processedAt: now } },
        { session }
      );

      // Iterated rather than bulk-updated so each deposit copies its own
      // `amount` into `heldAmount` and records a hold transaction.
      const deposits = await SecurityDeposit.find({ order: order._id }).session(session);
      for (const deposit of deposits) {
        if (deposit.status === 'held') continue;
        deposit.paymentStatus = 'held';
        deposit.holdStatus = 'held';
        deposit.status = 'held';
        deposit.heldAmount = deposit.amount;
        deposit.heldAt = now;
        deposit.transactions.push({
          type: 'hold',
          amount: deposit.amount,
          reason: 'Security deposit held on payment confirmation',
          reference: params.gatewayPaymentId || order.paymentReference || generatePaymentReference('DEP'),
          createdAt: now,
        } as any);
        await deposit.save({ session });
      }

      return {
        ok: true as const,
        status: 200,
        data: {
          alreadyPaid: false,
          order: serializeOrderDoc(await Order.findById(order._id).populate('bookings').session(session)),
        },
      };
    });

    return result;
  } catch (error: any) {
    console.error('markOrderPaid error:', error);
    return { ok: false as const, status: 500, error: error?.message || 'Failed to confirm payment' };
  } finally {
    session.endSession();
  }
}

/** Records a failed/abandoned payment so the order stops holding stock. */
export async function markOrderPaymentFailed(params: { orderId: string; reason?: string }) {
  await connectToDatabase();

  const order = await Order.findById(params.orderId);
  if (!order) return { ok: false as const, status: 404, error: 'Order not found' };
  if (order.paymentStatus === 'paid') {
    return { ok: true as const, status: 200, data: { order: serializeOrderDoc(order) } };
  }

  order.paymentStatus = 'failed';
  order.status = 'payment_failed';
  order.notes = params.reason || order.notes;
  await order.save();

  // Usually a no-op, since an unpaid online order never took units off the
  // shelf — but it covers a failure callback arriving after a success one.
  const bookingIds = await Booking.find({ order: order._id }).distinct('_id');
  await releaseBookingStock(bookingIds);

  await Booking.updateMany({ order: order._id }, { $set: { paymentStatus: 'failed', status: 'cancelled' } });
  await Payment.updateMany(
    { order: order._id, status: 'pending' },
    { $set: { status: 'failed', failureReason: params.reason || 'Payment not completed' } }
  );

  return { ok: true as const, status: 200, data: { order: serializeOrderDoc(order) } };
}

export async function updateBookingLifecycle(params: {
  bookingId: string;
  /**
   * Scopes the booking lookup to one customer. Omit for admin-initiated
   * actions, which operate on any booking.
   */
  userId?: string;
  action: 'cancel' | 'confirm_pickup' | 'return';
  returnCondition?: string;
  damageNotes?: string;
  missingAccessories?: string[];
  /**
   * Admin-only settlement overrides (return action).
   * lateFeeOverride replaces the auto-calculated fee — pass 0 to waive it.
   * damageCharge is deducted from the deposit on top of the late fee.
   */
  lateFeeOverride?: number;
  damageCharge?: number;
}) {
  await connectToDatabase();
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const bookingQuery: Record<string, unknown> = { _id: params.bookingId };
      if (params.userId) bookingQuery.user = params.userId;

      const booking = await Booking.findOne(bookingQuery)
        .populate({ path: 'product', populate: { path: 'category', select: 'name slug icon' } })
        .session(session);

      if (!booking) {
        return {
          ok: false as const,
          status: 404,
          error: 'Booking not found',
        };
      }

      if (params.action === 'cancel') {
        if (!CANCELLABLE_STATUSES.includes(booking.status as any) || booking.actualPickupAt) {
          return {
            ok: false as const,
            status: 400,
            error: 'Cannot cancel this booking',
          };
        }

        booking.status = 'cancelled';
        booking.returnStatus = 'cancelled';
        // The goods never went out, so the held units go straight back.
        await restoreProductStock(booking, session);
        booking.paymentStatus = booking.paymentStatus === 'paid' ? 'refunded' : booking.paymentStatus;
        booking.depositPaymentStatus = booking.depositPaymentStatus === 'held' ? 'released' : booking.depositPaymentStatus;
        booking.depositHeldStatus = 'released';
        booking.depositRefundStatus = 'refunded';
        booking.depositRefunded = true;
        booking.depositRefundAmount = booking.securityDeposit;
        booking.depositDeductedAmount = 0;
        booking.refundDate = new Date();
        booking.balanceDue = 0;
        booking.depositHistory.push({
          type: 'refund',
          amount: booking.securityDeposit,
          reason: 'Cancellation refund',
          reference: generatePaymentReference('REF'),
          createdAt: new Date(),
        });

        const depositRecord = await SecurityDeposit.findOne({ booking: booking._id }).session(session);
        if (depositRecord) {
          depositRecord.paymentStatus = 'refunded';
          depositRecord.holdStatus = 'released';
          depositRecord.refundStatus = 'refunded';
          depositRecord.status = 'refunded';
          depositRecord.refundedAmount = booking.securityDeposit;
          depositRecord.deductedAmount = 0;
          depositRecord.balanceDue = 0;
          depositRecord.releasedAt = new Date();
          depositRecord.refundDate = new Date();
          depositRecord.transactions.push({
            type: 'refund',
            amount: booking.securityDeposit,
            reason: 'Cancellation refund',
            reference: generatePaymentReference('REF'),
            createdAt: new Date(),
          });
          await depositRecord.save({ session });
          booking.securityDepositRecord = depositRecord._id;
        }

        const refundPayments = await Payment.create(
          [
            {
              user: booking.user,
              order: booking.order,
              booking: booking._id,
              bookingId: booking._id,
              purpose: 'rental_charge',
              provider: 'mock',
              method: booking.paymentMethod,
              status: 'refunded',
              amount: booking.rentalAmount,
              currency: 'INR',
              gatewayReference: generatePaymentReference('REF'),
              metadata: { reason: 'Booking cancellation refund' },
              processedAt: new Date(),
            },
            {
              user: booking.user,
              order: booking.order,
              booking: booking._id,
              bookingId: booking._id,
              purpose: 'security_deposit_refund',
              provider: 'mock',
              method: booking.paymentMethod,
              status: 'refunded',
              amount: booking.securityDeposit,
              currency: 'INR',
              gatewayReference: generatePaymentReference('REF'),
              metadata: { reason: 'Booking cancellation deposit refund' },
              processedAt: new Date(),
            },
          ] as any,
          { session }
        );
        booking.payment = refundPayments[0]._id;

        await booking.save({ session });
        if (booking.order) {
          await refreshOrderAggregates(booking.order as mongoose.Types.ObjectId, session);
        }

        return {
          ok: true as const,
          status: 200,
          data: {
            booking: serializeBookingDoc(await Booking.findById(booking._id).populate('product').session(session)),
          },
        };
      }

      if (params.action === 'confirm_pickup') {
        if (!['confirmed', 'ready_for_pickup', 'out_for_delivery'].includes(booking.status)) {
          return {
            ok: false as const,
            status: 400,
            error: 'Cannot confirm pickup for this booking',
          };
        }

        booking.status = 'active';
        booking.pickupConfirmationStatus = 'confirmed';
        booking.pickupConfirmedAt = new Date();
        booking.actualPickupAt = booking.pickupConfirmedAt;
        booking.overdue = false;

        // Normally a no-op — the units left the shelf when the order was
        // confirmed. Kept so bookings created before stock moved to
        // confirmation-time still deduct exactly once.
        await deductProductStock(booking, session);

        await booking.save({ session });

        return {
          ok: true as const,
          status: 200,
          data: {
            booking: serializeBookingDoc(await Booking.findById(booking._id).populate('product').session(session)),
          },
        };
      }

      if (params.action === 'return') {
        if (![...RETURNABLE_STATUSES, 'active', 'overdue'].includes(booking.status as any)) {
          return {
            ok: false as const,
            status: 400,
            error: 'Cannot return this booking',
          };
        }

        const now = new Date();
        const lateFee = calculateLateFeeBreakdown({
          pricePerDay: booking.pricePerDay,
          expectedReturnAt: booking.expectedReturnAt,
          actualReturnAt: now,
        });

        // Admin may waive or adjust the auto-calculated fee (0 = waived).
        const effectiveLateFee =
          params.lateFeeOverride !== undefined
            ? Math.max(0, Math.round(params.lateFeeOverride))
            : lateFee.totalLateFee;
        const damageCharge = Math.max(0, Math.round(params.damageCharge || 0));

        const deductionAmount = effectiveLateFee + damageCharge;
        const settlement = calculateDepositSettlement({
          depositAmount: booking.securityDeposit,
          deductedAmount: deductionAmount,
        });

        booking.actualReturnDate = now;
        booking.actualReturnAt = now;
        booking.returnConfirmationStatus = 'confirmed';
        booking.returnStatus = 'returned';
        booking.returnCondition = params.returnCondition || booking.returnCondition;
        booking.damageNotes = params.damageNotes || booking.damageNotes;
        booking.missingAccessories = params.missingAccessories || booking.missingAccessories || [];
        booking.overdue = lateFee.isLate;
        booking.lateFeeRateType = lateFee.rateType;
        booking.lateFeeRate = lateFee.ratePerUnit;
        booking.lateDurationMinutes = lateFee.lateMinutes;
        booking.lateDurationHours = lateFee.lateHours;
        booking.lateDurationDays = lateFee.lateDays;
        booking.lateFees = effectiveLateFee;
        booking.damageCharge = damageCharge;
        booking.depositDeductedAmount = settlement.deductedAmount;
        booking.depositRefundAmount = settlement.refundedAmount;
        booking.depositRefunded = settlement.refundedAmount > 0;
        booking.balanceDue = settlement.balanceDue;
        booking.refundDate = settlement.refundedAmount > 0 ? now : undefined;
        const deductionReasons: string[] = [];
        if (effectiveLateFee > 0) {
          deductionReasons.push(
            lateFee.rateType === 'hourly'
              ? `Late return charged hourly (${effectiveLateFee})`
              : `Late return charged daily (${effectiveLateFee})`
          );
        }
        if (damageCharge > 0) {
          deductionReasons.push(
            `${params.returnCondition === 'missing_accessories' ? 'Missing accessories' : 'Damage'} charge (${damageCharge})`
          );
        }
        booking.deductionReason = deductionReasons.length ? deductionReasons.join(' + ') : undefined;
        booking.depositRefundStatus = settlement.deductedAmount > 0 && settlement.refundedAmount > 0 ? 'partially_refunded' : settlement.deductedAmount > 0 ? 'deducted' : 'refunded';
        booking.depositPaymentStatus = settlement.deductedAmount > 0 && settlement.refundedAmount > 0 ? 'partially_refunded' : settlement.deductedAmount > 0 ? 'deducted' : 'refunded';
        booking.depositHeldStatus = 'released';
        booking.status = 'completed';
        booking.paymentStatus = 'paid';
        booking.returnStatus = 'completed';
        booking.depositHistory.push({
          type: settlement.deductedAmount > 0 ? 'deduction' : 'refund',
          amount: settlement.deductedAmount > 0 ? settlement.deductedAmount : settlement.refundedAmount,
          reason: booking.deductionReason || 'Security deposit refund',
          reference: generatePaymentReference(settlement.deductedAmount > 0 ? 'DED' : 'REF'),
          createdAt: now,
        });
        if (settlement.refundedAmount > 0) {
          booking.depositHistory.push({
            type: 'refund',
            amount: settlement.refundedAmount,
            reason: 'Security deposit refund',
            reference: generatePaymentReference('REF'),
            createdAt: now,
          });
        }

        const depositRecord = await SecurityDeposit.findOne({ booking: booking._id }).session(session);
        if (depositRecord) {
          depositRecord.refundedAmount = settlement.refundedAmount;
          depositRecord.deductedAmount = settlement.deductedAmount;
          depositRecord.balanceDue = settlement.balanceDue;
          depositRecord.paymentStatus = settlement.deductedAmount > 0 && settlement.refundedAmount > 0 ? 'partially_refunded' : settlement.deductedAmount > 0 ? 'deducted' : 'refunded';
          depositRecord.holdStatus = 'released';
          depositRecord.refundStatus = settlement.deductedAmount > 0 && settlement.refundedAmount > 0 ? 'partially_refunded' : settlement.deductedAmount > 0 ? 'deducted' : 'refunded';
          depositRecord.status = settlement.deductedAmount > 0 && settlement.refundedAmount > 0 ? 'partially_refunded' : settlement.deductedAmount > 0 ? 'deducted' : 'refunded';
          depositRecord.refundDate = settlement.refundedAmount > 0 ? now : undefined;
          depositRecord.releasedAt = now;
          depositRecord.deductionReason = booking.deductionReason;
          if (settlement.deductedAmount > 0) {
            depositRecord.transactions.push({
              type: 'deduction',
              amount: settlement.deductedAmount,
              reason: booking.deductionReason || 'Late fee deduction',
              reference: generatePaymentReference('DED'),
              createdAt: now,
            });
          }
          if (settlement.refundedAmount > 0) {
            depositRecord.transactions.push({
              type: 'refund',
              amount: settlement.refundedAmount,
              reason: 'Security deposit refund',
              reference: generatePaymentReference('REF'),
              createdAt: now,
            });
          }
          await depositRecord.save({ session });
          booking.securityDepositRecord = depositRecord._id;
        }

        const paymentRecords = [];
        if (settlement.deductedAmount > 0) {
          paymentRecords.push({
            user: booking.user,
            order: booking.order,
            booking: booking._id,
            bookingId: booking._id,
            purpose: 'late_fee_deduction',
            provider: 'mock',
            method: booking.paymentMethod,
            status: 'deducted',
            amount: settlement.deductedAmount,
            currency: 'INR',
            gatewayReference: generatePaymentReference('DED'),
            metadata: { reason: booking.deductionReason || 'Late return deduction' },
            processedAt: now,
          });
        }
        if (settlement.refundedAmount > 0) {
          paymentRecords.push({
            user: booking.user,
            order: booking.order,
            booking: booking._id,
            bookingId: booking._id,
            purpose: 'security_deposit_refund',
            provider: 'mock',
            method: booking.paymentMethod,
            status: 'refunded',
            amount: settlement.refundedAmount,
            currency: 'INR',
            gatewayReference: generatePaymentReference('REF'),
            metadata: { reason: 'Security deposit refund' },
            processedAt: now,
          });
        }
        if (settlement.balanceDue > 0) {
          paymentRecords.push({
            user: booking.user,
            order: booking.order,
            booking: booking._id,
            bookingId: booking._id,
            purpose: 'late_fee_collection',
            provider: 'mock',
            method: booking.paymentMethod,
            status: 'pending',
            amount: settlement.balanceDue,
            currency: 'INR',
            gatewayReference: generatePaymentReference('DUE'),
            metadata: { reason: 'Late fee balance due after deposit settlement' },
            processedAt: now,
          });
        }
        if (paymentRecords.length > 0) {
          // Mongoose refuses to create multiple documents inside a session
          // unless the insert is explicitly ordered.
          await Payment.create(paymentRecords as any, { session, ordered: true });
        }

        await restoreProductStock(booking, session);

        await booking.save({ session });
        if (booking.order) {
          await refreshOrderAggregates(booking.order as mongoose.Types.ObjectId, session);
        }

        return {
          ok: true as const,
          status: 200,
          data: {
            booking: serializeBookingDoc(await Booking.findById(booking._id).populate('product').session(session)),
            lateFee,
            settlement,
          },
        };
      }

      return {
        ok: false as const,
        status: 400,
        error: 'Unsupported booking action',
      };
    });

    return result;
  } catch (error: any) {
    console.error('updateBookingLifecycle error:', error);
    return {
      ok: false as const,
      status: 500,
      error: error?.message || 'Failed to update booking',
    };
  } finally {
    session.endSession();
  }
}

export async function markOverdueBookings() {
  await connectToDatabase();
  const now = new Date();
  await Booking.updateMany(
    {
      status: { $in: ['confirmed', 'ready_for_pickup', 'out_for_delivery', 'active'] },
      expectedReturnAt: { $lt: now },
    },
    {
      $set: {
        status: 'overdue',
        overdue: true,
      },
    }
  );
}

export async function getUserBookings(userId: string, status?: string) {
  await connectToDatabase();
  await markOverdueBookings();

  const where: Record<string, unknown> = { user: userId };
  if (status) where.status = status;

  const bookings = await Booking.find(where)
    .populate({
      path: 'product',
      populate: { path: 'category', select: 'name slug icon' },
    })
    .populate('order')
    .sort({ createdAt: -1 });

  return bookings.map((booking) => serializeBookingDoc(booking));
}

export async function getUserOrders(userId: string, status?: string) {
  await connectToDatabase();
  const where: Record<string, unknown> = { user: userId };
  if (status) where.status = status;

  const orders = await Order.find(where).sort({ createdAt: -1 });
  return orders.map((order) => serializeOrderDoc(order));
}
