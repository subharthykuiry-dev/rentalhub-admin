import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import Admin from '@/models/Admin';
import { signAdminToken } from '@/lib/auth/auth';
import connectToDatabase from '@/config/db';

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin with this email already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newAdmin = await Admin.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    // Sign JWT Token
    // const token = signAdminToken({
    //   adminId: newAdmin._id.toString(),
    //   email: newAdmin.email,
    // });

    return NextResponse.json(
      {
        success: true,
        // token, // 👈 Frontend receives and stores in localStorage
        admin: {
          _id: newAdmin._id,
          name: newAdmin.name,
          email: newAdmin.email,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}