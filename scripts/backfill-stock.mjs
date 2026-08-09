/**
 * ONE-TIME BACKFILL — run once after deploying confirmation-time stock holds.
 *
 * Stock used to leave `product.availableStock` at pickup; it now leaves when the
 * order is committed to fulfilment. In-flight bookings therefore carry no
 * `stockDeducted` flag, and older bugs (cancellations that never restored, and
 * no-show bookings that restored stock they never took) have left the counter
 * drifted. This does both jobs at once:
 *
 *   1. flags every booking that should be holding units under the new rule,
 *   2. recomputes `availableStock` from those flags, so the counter is exact.
 *
 * Idempotent — safe to re-run, and worth re-running if the counter ever drifts.
 *
 *   node --env-file=.env scripts/backfill-stock.mjs           # report, writes nothing
 *   node --env-file=.env scripts/backfill-stock.mjs --apply   # persist changes
 */
import mongoose from 'mongoose';

/** Statuses whose units are out of circulation under the new rule. */
const HOLDING_STATUSES = ['confirmed', 'ready_for_pickup', 'out_for_delivery', 'active', 'overdue'];

const APPLY = process.argv.includes('--apply');
const URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!URI) {
  console.error('Set MONGODB_URI (or MONGO_URI) before running this.');
  process.exit(1);
}

await mongoose.connect(URI, { bufferCommands: false });
const db = mongoose.connection.db;
const bookings = db.collection('bookings');
const products = db.collection('products');

const holding = { status: { $in: HOLDING_STATUSES } };
const toFlag = await bookings.countDocuments({ ...holding, stockDeducted: { $ne: true } });
const toClear = await bookings.countDocuments({ status: { $nin: HOLDING_STATUSES }, stockDeducted: true });

console.log(`bookings to mark as holding stock: ${toFlag}`);
console.log(`bookings to clear:                 ${toClear}`);

if (APPLY) {
  await bookings.updateMany(holding, { $set: { stockDeducted: true } });
  await bookings.updateMany({ status: { $nin: HOLDING_STATUSES } }, { $set: { stockDeducted: false } });
}

// Sum held quantities per product, then rebuild availableStock from totalStock.
const held = new Map(
  (
    await bookings
      .aggregate([{ $match: holding }, { $group: { _id: '$product', quantity: { $sum: '$quantity' } } }])
      .toArray()
  ).map((row) => [String(row._id), row.quantity])
);

let drifted = 0;
for await (const product of products.find({}, { projection: { totalStock: 1, availableStock: 1, name: 1 } })) {
  const total = product.totalStock || 0;
  const expected = Math.max(0, total - (held.get(String(product._id)) || 0));
  if (product.availableStock === expected) continue;

  drifted += 1;
  console.log(`  ${product.name}: availableStock ${product.availableStock} -> ${expected} (of ${total})`);
  if (APPLY) {
    await products.updateOne(
      { _id: product._id },
      { $set: { availableStock: expected, availableQuantity: expected } }
    );
  }
}

console.log(`products with drifted stock: ${drifted}`);
console.log(APPLY ? 'Applied.' : 'Dry run — re-run with --apply to persist.');

await mongoose.disconnect();
