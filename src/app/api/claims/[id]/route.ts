import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existingClaim = await prisma.claim.findUnique({
      where: { id },
    });

    if (!existingClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const supplierName = formData.get('supplierName') as string | null;
    const referenceNumber = formData.get('referenceNumber') as string | null;
    const dateStr = formData.get('date') as string | null;
    const accountId = formData.get('accountId') as string | null;
    const itemDescription = formData.get('itemDescription') as string | null;
    const amountStr = formData.get('amount') as string | null;
    const file = formData.get('file') as File | null;
    const status = formData.get('status') as string | null; // Admins can update status
    const isArchivedStr = formData.get('isArchived') as string | null;
    const isStaffArchivedStr = formData.get('isStaffArchived') as string | null;

    const isOnlyStaffArchiving = 
      user.role === 'STAFF' &&
      isStaffArchivedStr !== null &&
      !supplierName && !referenceNumber && !dateStr && !accountId && !itemDescription && !amountStr && !file;

    // Role checks: Staff can only update their own claims. Detail modifications require status === PENDING.
    if (user.role === 'STAFF') {
      if (existingClaim.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (existingClaim.status !== 'PENDING' && !isOnlyStaffArchiving) {
        return NextResponse.json({ error: 'Cannot modify details of a processed claim' }, { status: 400 });
      }
    }

    const updateData: {
      supplierName?: string;
      referenceNumber?: string;
      date?: Date;
      accountId?: string;
      itemDescription?: string;
      amount?: number;
      status?: string;
      receiptUrl?: string;
      isArchived?: boolean;
      isStaffArchived?: boolean;
    } = {};

    if (supplierName) updateData.supplierName = supplierName;
    if (referenceNumber) updateData.referenceNumber = referenceNumber;
    if (dateStr) updateData.date = new Date(dateStr);
    if (accountId) updateData.accountId = accountId;
    if (itemDescription) updateData.itemDescription = itemDescription;

    if (amountStr) {
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
      }
      updateData.amount = amount;
    }

    if (status && user.role === 'ADMIN') {
      if (status !== 'PENDING' && status !== 'APPROVED' && status !== 'REJECTED') {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = status;
    }

    if (isArchivedStr !== null && user.role === 'ADMIN') {
      updateData.isArchived = isArchivedStr === 'true';
    }

    if (isStaffArchivedStr !== null) {
      updateData.isStaffArchived = isStaffArchivedStr === 'true';
    }

    if (file && file.size > 0) {
      // Delete old receipt file if it exists
      if (existingClaim.receiptUrl) {
        try {
          const oldPath = join(process.cwd(), 'public', existingClaim.receiptUrl);
          await unlink(oldPath);
        } catch (e) {
          console.warn('Failed to delete old file:', e);
        }
      }

      const uploadDir = join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadDir, { recursive: true });

      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${Date.now()}-${safeName}`;
      const filePath = join(uploadDir, fileName);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await writeFile(filePath, buffer);
      updateData.receiptUrl = `/uploads/${fileName}`;
    }

    const updatedClaim = await prisma.claim.update({
      where: { id },
      data: updateData,
      include: {
        account: true,
      },
    });

    return NextResponse.json({ claim: updatedClaim });
  } catch (error) {
    console.error('Update claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existingClaim = await prisma.claim.findUnique({
      where: { id },
    });

    if (!existingClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Role checks
    if (user.role === 'STAFF') {
      if (existingClaim.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (existingClaim.status !== 'PENDING') {
        return NextResponse.json({ error: 'Cannot delete a processed claim' }, { status: 400 });
      }
    }

    // Delete receipt file if it exists
    if (existingClaim.receiptUrl) {
      try {
        const filePath = join(process.cwd(), 'public', existingClaim.receiptUrl);
        await unlink(filePath);
      } catch (e) {
        console.warn('Failed to delete file:', e);
      }
    }

    await prisma.claim.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Claim deleted successfully' });
  } catch (error) {
    console.error('Delete claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
