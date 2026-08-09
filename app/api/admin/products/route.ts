import { NextResponse } from 'next/server';
import Product from '@/models/Product';
import connectToDatabase from '@/config/db';
import { requireAdmin, unauthorized } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

/**
 * The signed-in admin's own catalogue.
 *
 * Ownership comes from the JWT, never from a query parameter — the previous
 * `/api/products?publishedBy=<email>` form read that email out of localStorage,
 * which the browser fully controls, so anyone could edit it in devtools and
 * pull another admin's inventory.
 */
export async function GET(req: Request) {
  const admin = requireAdmin(req);
  if (!admin) return unauthorized();

  try {
    await connectToDatabase();

    const products = await Product.find({ publishedBy: admin.email })
      .populate('category', 'name slug icon')
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, count: products.length, data: products });
  } catch (error) {
    console.error('Admin products GET error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

/** Deletes a product, but only one this admin published. */
export async function DELETE(req: Request) {
  const admin = requireAdmin(req);
  if (!admin) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await connectToDatabase();

    const product = await Product.findById(id).select('publishedBy name');
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    if (product.publishedBy !== admin.email) {
      return NextResponse.json(
        { error: 'This product was published by another admin.' },
        { status: 403 }
      );
    }

    await Product.deleteOne({ _id: id });
    return NextResponse.json({ success: true, data: { name: product.name } });
  } catch (error) {
    console.error('Admin products DELETE error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
