import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admins can see all accounts (active and inactive), staff only active ones
    const where = user.role === 'ADMIN' ? {} : { isActive: true };

    const accounts = await prisma.account.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Fetch accounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { code, name } = await request.json();

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and Name are required' }, { status: 400 });
    }

    // Check if code already exists
    const existing = await prisma.account.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 400 });
    }

    const newAccount = await prisma.account.create({
      data: {
        code,
        name,
        isActive: true,
      },
    });

    return NextResponse.json({ account: newAccount });
  } catch (error) {
    console.error('Create account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
