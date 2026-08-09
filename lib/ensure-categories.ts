import Category from '@/models/Category';
import { RENTAL_CATEGORIES } from '@/lib/categories-seed';

/**
 * Idempotently upserts the canonical rental categories.
 *
 * Runs on GET /api/categories so the admin product dropdown and the storefront
 * always have the current category set — including ones added to
 * categories-seed.ts after the database was first populated.
 *
 * Upserts by slug with $setOnInsert, so renaming a category or swapping its
 * image in the database is never overwritten by a later boot. Only genuinely
 * new slugs get written.
 *
 * Cached per process: the work is one bulkWrite, but there is no reason to
 * repeat it on every request. Assumes the caller has already connected.
 */
let seedPromise: Promise<{ seeded: number }> | null = null;

async function runSeed() {
  const result = await Category.bulkWrite(
    RENTAL_CATEGORIES.map((cat) => ({
      updateOne: {
        filter: { slug: cat.slug },
        update: { $setOnInsert: { ...cat, isActive: true } },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  return { seeded: result.upsertedCount ?? 0 };
}

export async function ensureCategoriesSeeded() {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      // Don't cache a failure — let the next request retry.
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

export default ensureCategoriesSeeded;
