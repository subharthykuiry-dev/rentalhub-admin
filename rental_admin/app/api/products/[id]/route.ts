import { NextResponse } from 'next/server';
import Product, { normalizeProductFields } from '@/models/Product';
import Category from '@/models/Category';
import connectToDatabase from '@/config/db';

interface Params {
  params: Promise<{ id: string }>;
}

// GET: Fetch a single product by ID
export async function GET(req: Request, { params }: Params) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: product }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// PUT: Update an existing product
export async function PUT(req: Request, { params }: Params) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();

    delete body._id;
    delete body.id;

    // Category stays compulsory on edit — an update must not be able to strip
    // a product out of storefront category browse.
    if ('category' in body) {
      if (!body.category) {
        return NextResponse.json(
          { success: false, error: 'Category is required — pick one before saving.' },
          { status: 400 }
        );
      }
      const exists = await Category.exists({ _id: body.category });
      if (!exists) {
        return NextResponse.json(
          { success: false, error: 'That category no longer exists. Reload the form and pick again.' },
          { status: 400 }
        );
      }
    }

    // findByIdAndUpdate skips document middleware, so run the same
    // admin<->catalog field reconciliation the pre-validate hook would have.
    normalizeProductFields(body);

    const updatedProduct = await Product.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updatedProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: updatedProduct },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

// DELETE: Remove a product
export async function DELETE(req: Request, { params }: Params) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Product deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}