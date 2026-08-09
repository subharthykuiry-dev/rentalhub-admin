import cloudinary from '@/lib/cloudinary/cloudinary';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Convert file object to buffer stream
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload directly to Cloudinary inside the "rental_admin/products" folder
    const uploadResult = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: 'rental_admin/products',
              resource_type: 'auto',
            },
            (error, result) => {
              if (error || !result) {
                reject(error || new Error('Cloudinary upload failed'));
              } else {
                resolve({
                  secure_url: result.secure_url,
                  public_id: result.public_id,
                });
              }
            }
          )
          .end(buffer);
      }
    );

    return NextResponse.json(
      {
        success: true,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Product Image Upload Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload product image to Cloudinary' },
      { status: 500 }
    );
  }
}