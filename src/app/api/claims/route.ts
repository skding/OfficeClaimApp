import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    const where: { userId?: string; status?: string } = {};

    // Staff can only view their own claims.
    // Admin can view all claims or filter by a specific userId
    if (user.role === 'STAFF') {
      where.userId = user.id;
    } else if (userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    const claims = await prisma.claim.findMany({
      where,
      include: {
        account: {
          select: { id: true, code: true, name: true }
        },
        user: {
          select: { name: true, username: true }
        }
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ claims });
  } catch (error) {
    console.error('Fetch claims error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const supplierName = formData.get('supplierName') as string;
    const referenceNumber = formData.get('referenceNumber') as string;
    const dateStr = formData.get('date') as string;
    const accountId = formData.get('accountId') as string;
    const itemDescription = formData.get('itemDescription') as string;
    const amountStr = formData.get('amount') as string;
    const file = formData.get('file') as File | null;

    if (!supplierName || !referenceNumber || !dateStr || !accountId || !itemDescription || !amountStr) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    let receiptUrl: string | null = null;

    if (file && file.size > 0) {
      const uploadDir = join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadDir, { recursive: true });

      // Sanitize file name
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${Date.now()}-${safeName}`;
      const filePath = join(uploadDir, fileName);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await writeFile(filePath, buffer);
      receiptUrl = `/uploads/${fileName}`;
    }

    const claim = await prisma.claim.create({
      data: {
        supplierName,
        referenceNumber,
        date: new Date(dateStr),
        accountId,
        itemDescription,
        amount,
        receiptUrl,
        userId: user.id,
        status: 'PENDING',
      },
      include: {
        account: true,
      },
    });

    return NextResponse.json({ claim });
  } catch (error) {
    console.error('Create claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
