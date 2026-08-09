import { NextResponse } from 'next/server';
import connectToDatabase from '@/config/db';
import Category from '@/models/Category';
import { ensureCategoriesSeeded } from '@/lib/ensure-categories';

// GET: categories for the product form dropdown (shared with the user app's
// catalog navigation — a product must have one to be browsable there).
export async function GET() {
  try {
    await connectToDatabase();
    await ensureCategoriesSeeded();

    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    return NextResponse.json({ success: true, data: categories }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST: create a category inline from the product form.
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Category name is required' },
        { status: 400 }
      );
    }

    if (!body.slug) {
      body.slug = body.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-');
    }

    const existing = await Category.findOne({ slug: body.slug });
    if (existing) {
      return NextResponse.json({ success: true, data: existing }, { status: 200 });
    }

    const category = await Category.create(body);
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
