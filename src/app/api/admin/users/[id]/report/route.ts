import { NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

function wrapText(text: string, maxWidth: number, fontSize: number, font: any): string[] {
  if (!text) return ['-'];
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
            let rem = word;
            while (rem.length > 0) {
              let splitAt = rem.length;
              while (splitAt > 1 && font.widthOfTextAtSize(rem.substring(0, splitAt), fontSize) > maxWidth) {
                splitAt--;
              }
              lines.push(rem.substring(0, splitAt));
              rem = rem.substring(splitAt);
            }
            currentLine = '';
          } else {
            currentLine = word;
          }
        } else {
          let rem = word;
          while (rem.length > 0) {
            let splitAt = rem.length;
            while (splitAt > 1 && font.widthOfTextAtSize(rem.substring(0, splitAt), fontSize) > maxWidth) {
              splitAt--;
            }
            lines.push(rem.substring(0, splitAt));
            rem = rem.substring(splitAt);
          }
          currentLine = '';
        }
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  return lines.length > 0 ? lines : ['-'];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return new NextResponse('Unauthorized', { status: 403 });
    }

    const { id } = await params; // employee userId

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const archivedParam = searchParams.get('archived') || searchParams.get('isArchived');
    const isArchived = archivedParam === 'true';

    // Fetch employee details
    const employee = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
      },
    });

    if (!employee) {
      return new NextResponse('Employee not found', { status: 404 });
    }

    // Build Prisma query condition
    const where: any = {
      userId: id,
      status: 'APPROVED',
      isArchived: isArchived,
    };

    if (startDateStr || endDateStr) {
      where.date = {};
      if (startDateStr) {
        where.date.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    // Fetch approved claims
    const claims = await prisma.claim.findMany({
      where,
      include: {
        account: true,
      },
      orderBy: { date: 'asc' },
    });

    // Requirement 2: Split into 2 groups
    const expenseClaims = claims.filter((c) => c.claimType !== 'PAYROLL');
    const payrollClaims = claims.filter((c) => c.claimType === 'PAYROLL');

    const expenseSubtotal = expenseClaims.reduce((sum, c) => sum + c.amount, 0);
    const payrollSubtotal = payrollClaims.reduce((sum, c) => sum + c.amount, 0);
    const grandTotal = expenseSubtotal + payrollSubtotal;

    // Initialize PDF Document
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Create Page 1 (A4: 595 x 842 points)
    let currentPage = pdfDoc.addPage([595, 842]);
    const { width, height } = currentPage.getSize();

    // ─── HEADER BANNER ───────────────────────────────────────────────────────
    currentPage.drawRectangle({
      x: 40,
      y: height - 95,
      width: width - 80,
      height: 55,
      color: isArchived ? rgb(0.2, 0.15, 0.28) : rgb(0.12, 0.15, 0.27),
    });

    const reportTitle = isArchived
      ? 'EMPLOYEE CLAIMS SUMMARY REPORT (ARCHIVED)'
      : 'EMPLOYEE CLAIMS SUMMARY REPORT';

    currentPage.drawText(reportTitle, {
      x: 55,
      y: height - 72,
      size: 13,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    let rangeStr = isArchived ? 'Archived Approved Records' : 'All Active Approved Claims';
    if (startDateStr && endDateStr) {
      rangeStr = `Date Period: ${startDateStr} to ${endDateStr}`;
    } else if (startDateStr) {
      rangeStr = `Date Period: Since ${startDateStr}`;
    } else if (endDateStr) {
      rangeStr = `Date Period: Until ${endDateStr}`;
    }

    currentPage.drawText(rangeStr, {
      x: 55,
      y: height - 88,
      size: 8.5,
      font: helvetica,
      color: rgb(0.8, 0.8, 0.8),
    });

    const nowStr = new Date().toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    currentPage.drawText(`Generated: ${nowStr}`, {
      x: width - 220,
      y: height - 72,
      size: 8,
      font: helvetica,
      color: rgb(0.8, 0.8, 0.8),
    });

    if (isArchived) {
      currentPage.drawRectangle({
        x: width - 220,
        y: height - 90,
        width: 100,
        height: 14,
        color: rgb(0.5, 0.3, 0.6),
      });
      currentPage.drawText('ARCHIVED REPRINT', {
        x: width - 212,
        y: height - 86,
        size: 7,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });
    }

    // ─── EMPLOYEE PROFILE CARD WITH SUBTOTAL SUMMARY ────────────────────────
    currentPage.drawRectangle({
      x: 40,
      y: height - 165,
      width: width - 80,
      height: 60,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: rgb(0.85, 0.88, 0.9),
      borderWidth: 1,
    });

    currentPage.drawText('EMPLOYEE PROFILE:', {
      x: 50,
      y: height - 120,
      size: 8,
      font: helveticaBold,
      color: rgb(0.4, 0.45, 0.5),
    });
    currentPage.drawText(`Name: ${employee.name || employee.username}`, {
      x: 50,
      y: height - 134,
      size: 10,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.15),
    });
    currentPage.drawText(`Username: @${employee.username}`, {
      x: 50,
      y: height - 146,
      size: 8.5,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });
    currentPage.drawText(`Approved Claims: ${claims.length} total (${expenseClaims.length} Expense, ${payrollClaims.length} Allowance)`, {
      x: 50,
      y: height - 158,
      size: 8,
      font: helvetica,
      color: rgb(0.45, 0.5, 0.55),
    });

    // Subtotals breakdown on right side of profile card
    currentPage.drawText(`Expense Subtotal: RM ${expenseSubtotal.toFixed(2)}`, {
      x: width - 230,
      y: height - 120,
      size: 8.5,
      font: helvetica,
      color: rgb(0.2, 0.25, 0.3),
    });
    currentPage.drawText(`Payroll Allowance: RM ${payrollSubtotal.toFixed(2)}`, {
      x: width - 230,
      y: height - 133,
      size: 8.5,
      font: helvetica,
      color: rgb(0.2, 0.25, 0.3),
    });
    currentPage.drawText(`TOTAL CLAIM: RM ${grandTotal.toFixed(2)}`, {
      x: width - 230,
      y: height - 150,
      size: 11,
      font: helveticaBold,
      color: rgb(0.44, 0.35, 0.95),
    });

    let currentY = height - 195;

    const drawHeaders = (p: any, yPos: number) => {
      p.drawRectangle({
        x: 40,
        y: yPos - 5,
        width: 515,
        height: 18,
        color: rgb(0.12, 0.15, 0.27),
      });

      const drawHeaderCell = (text: string, xPos: number) => {
        p.drawText(text, {
          x: xPos + 5,
          y: yPos,
          size: 8,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });
      };

      drawHeaderCell('Date', 40);
      drawHeaderCell('Supplier / Merchant', 105);
      drawHeaderCell('Ref / Invoice No.', 220);
      drawHeaderCell('Account Category', 320);
      drawHeaderCell('Amount (RM)', 445);
    };

    if (claims.length === 0) {
      currentPage.drawText(
        isArchived
          ? 'No archived approved claims found for this employee matching the filter criteria.'
          : 'No active approved claims found for this employee matching the filter criteria.',
        {
          x: 50,
          y: currentY - 20,
          size: 10,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        }
      );
    } else {
      // ─── FUNCTION TO DRAW A CLAIM GROUP ──────────────────────────────────
      const renderGroup = (
        groupTitle: string,
        groupClaims: typeof claims,
        subtotal: number,
        badgeColor: { r: number; g: number; b: number }
      ) => {
        // Group Header Banner
        if (currentY - 35 < 65) {
          currentPage = pdfDoc.addPage([595, 842]);
          currentY = height - 60;
        }

        currentPage.drawRectangle({
          x: 40,
          y: currentY - 8,
          width: 515,
          height: 22,
          color: rgb(badgeColor.r, badgeColor.g, badgeColor.b),
        });

        currentPage.drawText(groupTitle.toUpperCase(), {
          x: 50,
          y: currentY,
          size: 9.5,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });

        const countText = `(${groupClaims.length} item${groupClaims.length === 1 ? '' : 's'})`;
        currentPage.drawText(countText, {
          x: 50 + helveticaBold.widthOfTextAtSize(groupTitle.toUpperCase(), 9.5) + 8,
          y: currentY,
          size: 8.5,
          font: helvetica,
          color: rgb(0.85, 0.9, 0.95),
        });

        currentPage.drawText(`Subtotal: RM ${subtotal.toFixed(2)}`, {
          x: 430,
          y: currentY,
          size: 9,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });

        currentY -= 26;

        // Table Column Headers
        drawHeaders(currentPage, currentY);
        currentY -= 20;

        if (groupClaims.length === 0) {
          currentPage.drawText('No claims recorded in this group.', {
            x: 55,
            y: currentY - 5,
            size: 8.5,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5),
          });
          currentY -= 25;
        } else {
          for (let i = 0; i < groupClaims.length; i++) {
            const claim = groupClaims[i];

            const claimDateStr = new Date(claim.date).toLocaleDateString('en-MY', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            });
            const supplierLines = wrapText(claim.supplierName || '-', 110, 8, helvetica);
            const refLines = wrapText(claim.referenceNumber || '-', 95, 8, helvetica);
            const catLines = wrapText(`${claim.account.code} - ${claim.account.name}`, 120, 8, helvetica);
            const amtStr = `RM ${claim.amount.toFixed(2)}`;

            const row1LinesCount = Math.max(supplierLines.length, refLines.length, catLines.length, 1);
            const row1Height = row1LinesCount * 11 + 4;

            const descLines = wrapText(claim.itemDescription || '-', 445, 7.5, helvetica);
            const row2Height = descLines.length * 9.5 + 4;

            const itemBlockHeight = row1Height + row2Height + 4;

            // Overflow check
            if (currentY - itemBlockHeight < 65) {
              currentPage = pdfDoc.addPage([595, 842]);
              currentY = height - 60;
              drawHeaders(currentPage, currentY);
              currentY -= 20;
            }

            // Alternating shading
            if (i % 2 === 1) {
              currentPage.drawRectangle({
                x: 40,
                y: currentY - itemBlockHeight + 2,
                width: 515,
                height: itemBlockHeight - 2,
                color: rgb(0.96, 0.97, 0.99),
              });
            }

            // ROW 1
            const row1TopY = currentY - 9;
            currentPage.drawText(claimDateStr, {
              x: 45,
              y: row1TopY,
              size: 8,
              font: helvetica,
              color: rgb(0.15, 0.15, 0.15),
            });

            supplierLines.forEach((line, idx) => {
              currentPage.drawText(line, {
                x: 110,
                y: row1TopY - idx * 11,
                size: 8,
                font: helvetica,
                color: rgb(0.15, 0.15, 0.15),
              });
            });

            refLines.forEach((line, idx) => {
              currentPage.drawText(line, {
                x: 225,
                y: row1TopY - idx * 11,
                size: 8,
                font: helvetica,
                color: rgb(0.15, 0.15, 0.15),
              });
            });

            catLines.forEach((line, idx) => {
              currentPage.drawText(line, {
                x: 325,
                y: row1TopY - idx * 11,
                size: 8,
                font: helvetica,
                color: rgb(0.15, 0.15, 0.15),
              });
            });

            currentPage.drawText(amtStr, {
              x: 450,
              y: row1TopY,
              size: 8.5,
              font: helveticaBold,
              color: rgb(0.12, 0.15, 0.27),
            });

            // ROW 2 (Description)
            const row2TopY = currentY - row1Height - 3;
            currentPage.drawText('Description:', {
              x: 45,
              y: row2TopY,
              size: 7.5,
              font: helveticaBold,
              color: rgb(0.4, 0.45, 0.5),
            });

            descLines.forEach((line, idx) => {
              currentPage.drawText(line, {
                x: 100,
                y: row2TopY - idx * 9.5,
                size: 7.5,
                font: helvetica,
                color: rgb(0.25, 0.28, 0.32),
              });
            });

            // Separator line
            currentPage.drawLine({
              start: { x: 40, y: currentY - itemBlockHeight },
              end: { x: 555, y: currentY - itemBlockHeight },
              thickness: 0.5,
              color: rgb(0.85, 0.88, 0.9),
            });

            currentY -= itemBlockHeight + 2;
          }

          // Subtotal Row for this group
          if (currentY - 24 < 65) {
            currentPage = pdfDoc.addPage([595, 842]);
            currentY = height - 60;
          }

          currentPage.drawRectangle({
            x: 40,
            y: currentY - 6,
            width: 515,
            height: 18,
            color: rgb(0.93, 0.94, 0.97),
          });

          currentPage.drawText(`Subtotal (${groupTitle}):`, {
            x: 48,
            y: currentY,
            size: 8.5,
            font: helveticaBold,
            color: rgb(0.2, 0.25, 0.3),
          });

          currentPage.drawText(`RM ${subtotal.toFixed(2)}`, {
            x: 450,
            y: currentY,
            size: 8.5,
            font: helveticaBold,
            color: rgb(0.2, 0.25, 0.3),
          });

          currentY -= 26;
        }

        currentY -= 10;
      };

      // Render Group 1: EXPENSE CLAIMS
      renderGroup(
        '1. Expense Claims',
        expenseClaims,
        expenseSubtotal,
        { r: 0.18, g: 0.24, b: 0.42 }
      );

      // Render Group 2: PAYROLL SITE ALLOWANCE CLAIMS
      renderGroup(
        '2. Payroll Allowance Claims (Site Allowance)',
        payrollClaims,
        payrollSubtotal,
        { r: 0.24, g: 0.36, b: 0.32 }
      );

      // ─── GRAND TOTAL BAR ──────────────────────────────────────────────────
      if (currentY - 28 < 75) {
        currentPage = pdfDoc.addPage([595, 842]);
        currentY = height - 60;
      }

      currentPage.drawRectangle({
        x: 40,
        y: currentY - 8,
        width: 515,
        height: 24,
        color: rgb(0.9, 0.91, 0.98),
        borderColor: rgb(0.7, 0.65, 0.9),
        borderWidth: 1,
      });

      currentPage.drawText('GRAND TOTAL CLAIM AMOUNT:', {
        x: 48,
        y: currentY,
        size: 9.5,
        font: helveticaBold,
        color: rgb(0.12, 0.15, 0.27),
      });

      currentPage.drawText(`RM ${grandTotal.toFixed(2)}`, {
        x: 440,
        y: currentY,
        size: 10.5,
        font: helveticaBold,
        color: rgb(0.44, 0.35, 0.95),
      });

      // ─── SIGNATURE BLOCK ─────────────────────────────────────────────────
      currentY -= 55;
      if (currentY < 90) {
        currentPage = pdfDoc.addPage([595, 842]);
        currentY = height - 90;
      }

      currentPage.drawLine({
        start: { x: 45, y: currentY },
        end: { x: 200, y: currentY },
        thickness: 1,
        color: rgb(0.5, 0.55, 0.6),
      });
      currentPage.drawText('Prepared By (Administrator)', {
        x: 45,
        y: currentY - 12,
        size: 8,
        font: helvetica,
        color: rgb(0.4, 0.45, 0.5),
      });

      currentPage.drawLine({
        start: { x: 350, y: currentY },
        end: { x: 505, y: currentY },
        thickness: 1,
        color: rgb(0.5, 0.55, 0.6),
      });
      currentPage.drawText('Approved By (Manager)', {
        x: 350,
        y: currentY - 12,
        size: 8,
        font: helvetica,
        color: rgb(0.4, 0.45, 0.5),
      });
    }

    // ─── REQUIREMENT 4: COMBINE RECEIPT DETAILS + IMAGE INTO SINGLE PAGE ─────
    for (const claim of claims) {
      if (claim.receiptUrl) {
        const receiptPath = join(process.cwd(), 'public', claim.receiptUrl);
        try {
          const fileStats = await stat(receiptPath);
          if (fileStats.isFile()) {
            const receiptBuffer = await readFile(receiptPath);
            const urlLower = claim.receiptUrl.toLowerCase();

            // SINGLE PAGE for both receipt details AND receipt image
            const attachPage = pdfDoc.addPage([595, 842]);
            const { width: pW, height: pH } = attachPage.getSize();

            // 1. Compact Header Banner
            attachPage.drawRectangle({
              x: 40,
              y: pH - 65,
              width: pW - 80,
              height: 38,
              color: rgb(0.12, 0.15, 0.27),
            });

            attachPage.drawText('RECEIPT ATTACHMENT & CLAIM DETAILS', {
              x: 52,
              y: pH - 46,
              size: 11,
              font: helveticaBold,
              color: rgb(1, 1, 1),
            });

            const typeLabel =
              claim.claimType === 'PAYROLL'
                ? 'SITE ALLOWANCE (PAYROLL)'
                : 'EXPENSE CLAIM';

            attachPage.drawText(`ID: ${claim.id}  •  Type: ${typeLabel}`, {
              x: 52,
              y: pH - 58,
              size: 7.5,
              font: helvetica,
              color: rgb(0.8, 0.85, 0.9),
            });

            // 2. Compact Details Card
            const cardTopY = pH - 72;
            const cardHeight = 88;
            attachPage.drawRectangle({
              x: 40,
              y: cardTopY - cardHeight,
              width: pW - 80,
              height: cardHeight,
              color: rgb(0.97, 0.98, 0.99),
              borderColor: rgb(0.85, 0.88, 0.9),
              borderWidth: 1,
            });

            const claimDateStr = new Date(claim.date).toLocaleDateString('en-MY', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            // Row 1
            attachPage.drawText('Supplier / Vendor:', { x: 50, y: cardTopY - 16, size: 7.5, font: helveticaBold, color: rgb(0.4, 0.45, 0.5) });
            attachPage.drawText(claim.supplierName || '-', { x: 135, y: cardTopY - 16, size: 8, font: helveticaBold, color: rgb(0.1, 0.1, 0.15) });

            attachPage.drawText('Account Category:', { x: 290, y: cardTopY - 16, size: 7.5, font: helveticaBold, color: rgb(0.4, 0.45, 0.5) });
            attachPage.drawText(`${claim.account.code} - ${claim.account.name}`, { x: 375, y: cardTopY - 16, size: 8, font: helvetica, color: rgb(0.1, 0.1, 0.15) });

            // Row 2
            attachPage.drawText('Ref / Invoice No.:', { x: 50, y: cardTopY - 32, size: 7.5, font: helveticaBold, color: rgb(0.4, 0.45, 0.5) });
            attachPage.drawText(claim.referenceNumber || '-', { x: 135, y: cardTopY - 32, size: 8, font: helvetica, color: rgb(0.1, 0.1, 0.15) });

            attachPage.drawText('Expense Date:', { x: 290, y: cardTopY - 32, size: 7.5, font: helveticaBold, color: rgb(0.4, 0.45, 0.5) });
            attachPage.drawText(claimDateStr, { x: 375, y: cardTopY - 32, size: 8, font: helvetica, color: rgb(0.1, 0.1, 0.15) });

            // Row 3
            attachPage.drawText('Claim Category:', { x: 50, y: cardTopY - 48, size: 7.5, font: helveticaBold, color: rgb(0.4, 0.45, 0.5) });
            attachPage.drawText(typeLabel, { x: 135, y: cardTopY - 48, size: 8, font: helveticaBold, color: claim.claimType === 'PAYROLL' ? rgb(0.2, 0.55, 0.35) : rgb(0.12, 0.15, 0.27) });

            attachPage.drawText('Amount Claimed:', { x: 290, y: cardTopY - 48, size: 7.5, font: helveticaBold, color: rgb(0.4, 0.45, 0.5) });
            attachPage.drawText(`RM ${claim.amount.toFixed(2)}`, { x: 375, y: cardTopY - 48, size: 10, font: helveticaBold, color: rgb(0.44, 0.35, 0.95) });

            // Row 4: Description
            attachPage.drawText('Description:', { x: 50, y: cardTopY - 66, size: 7.5, font: helveticaBold, color: rgb(0.4, 0.45, 0.5) });
            const descLines = wrapText(claim.itemDescription || '-', pW - 195, 7.5, helvetica);
            const firstTwoDesc = descLines.slice(0, 2);
            firstTwoDesc.forEach((dl, dIdx) => {
              attachPage.drawText(dl, { x: 135, y: cardTopY - 66 - dIdx * 9.5, size: 7.5, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
            });

            // 3. Receipt Area (from cardBottom down to footer)
            const availableTopY = cardTopY - cardHeight - 10;
            const availableBottomY = 32;
            const maxW = pW - 80;
            const maxH = availableTopY - availableBottomY;

            if (urlLower.endsWith('.pdf')) {
              // PDF receipt: embed first page into the single page
              const srcPdf = await PDFDocument.load(receiptBuffer);
              const [embeddedPage] = await pdfDoc.embedPdf(srcPdf, [0]);
              const scale = Math.min(maxW / embeddedPage.width, maxH / embeddedPage.height);
              const finalW = embeddedPage.width * scale;
              const finalH = embeddedPage.height * scale;

              attachPage.drawPage(embeddedPage, {
                x: (pW - finalW) / 2,
                y: availableBottomY + (maxH - finalH) / 2,
                width: finalW,
                height: finalH,
              });

              // If the uploaded PDF had more than 1 page, append subsequent pages
              if (srcPdf.getPageCount() > 1) {
                const extraIndices = srcPdf.getPageIndices().slice(1);
                const extraPages = await pdfDoc.copyPages(srcPdf, extraIndices);
                extraPages.forEach((p) => pdfDoc.addPage(p));
              }
            } else if (
              urlLower.endsWith('.png') ||
              urlLower.endsWith('.jpg') ||
              urlLower.endsWith('.jpeg')
            ) {
              // Image receipt
              let img;
              if (urlLower.endsWith('.png')) {
                img = await pdfDoc.embedPng(receiptBuffer);
              } else {
                img = await pdfDoc.embedJpg(receiptBuffer);
              }

              const imgDims = img.scale(1);
              const scale = Math.min(maxW / imgDims.width, maxH / imgDims.height);
              const finalW = imgDims.width * scale;
              const finalH = imgDims.height * scale;

              attachPage.drawImage(img, {
                x: (pW - finalW) / 2,
                y: availableBottomY + (maxH - finalH) / 2,
                width: finalW,
                height: finalH,
              });
            }
          }
        } catch (err) {
          console.error(`Failed to append receipt for claim ${claim.id}:`, err);
          const errPage = pdfDoc.addPage([595, 842]);
          errPage.drawText('ERROR: Receipt attachment could not be compiled.', {
            x: 50,
            y: 420,
            size: 12,
            font: helveticaBold,
            color: rgb(0.75, 0.15, 0.15),
          });
          errPage.drawText(`Details: ${(err as Error).message}`, {
            x: 50,
            y: 395,
            size: 9,
            font: helvetica,
            color: rgb(0.4, 0.4, 0.4),
          });
        }
      }
    }

    // ─── DYNAMIC FOOTER ACROSS ALL PAGES ─────────────────────────────────────
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const { width: pW } = p.getSize();

      const footerLabel = isArchived
        ? `Employee claims report summary (ARCHIVED): ${employee.name || employee.username}`
        : `Employee claims report summary: ${employee.name || employee.username}`;

      p.drawText(footerLabel, {
        x: 40,
        y: 18,
        size: 7.5,
        font: helvetica,
        color: rgb(0.5, 0.55, 0.6),
      });

      p.drawText(`Page ${i + 1} of ${pages.length}`, {
        x: pW - 95,
        y: 18,
        size: 7.5,
        font: helvetica,
        color: rgb(0.5, 0.55, 0.6),
      });
    }

    const pdfBytes = await pdfDoc.save();

    const filename = isArchived
      ? `employee_summary_report_${employee.username}_archived.pdf`
      : `employee_summary_report_${employee.username}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes) as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Employee report generation error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
