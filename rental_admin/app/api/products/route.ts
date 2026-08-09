import { NextResponse } from 'next/server';
import Product, { normalizeProductFields } from '@/models/Product';
import Category from '@/models/Category';
import connectToDatabase from '@/config/db';

// GET: Retrieve all products
export async function GET(req: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const publishedBy = searchParams.get('publishedBy');

    const queryFilter: Record<string, any> = {};
    if (publishedBy) {
      queryFilter.publishedBy = publishedBy;
    }

    // populate category so the admin list can show it alongside store/brand
    const products = await Product.find(queryFilter)
      .populate('category', 'name slug icon')
      .sort({ createdAt: -1 });

    return NextResponse.json(
      { success: true, count: products.length, data: products },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET Products Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Category is compulsory: without it a product cannot appear in storefront
 * category browse, so we reject rather than silently filing it somewhere.
 * Returns an error string, or null when valid.
 */
async function validateCategory(body: Record<string, any>) {
  if (!body.category) return 'Category is required — pick one before saving.';

  const exists = await Category.exists({ _id: body.category });
  if (!exists) return 'That category no longer exists. Reload the form and pick again.';

  return null;
}

// POST: Save a new product
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    delete body._id;
    delete body.id;

    const categoryError = await validateCategory(body);
    if (categoryError) {
      return NextResponse.json({ success: false, error: categoryError }, { status: 400 });
    }

    // Reconcile the admin vocabulary (deposit{}, *Quantity, imageUrl) with the
    // catalog vocabulary the user app reads (securityDeposit, *Stock, images[]).
    normalizeProductFields(body);

    const newProduct = await Product.create(body);

    return NextResponse.json({ success: true, data: newProduct }, { status: 201 });
  } catch (error: any) {
    console.error('POST Product Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save product' },
      { status: 400 }
    );
  }
}
