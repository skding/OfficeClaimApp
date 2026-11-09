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

    const { id } = await params;

    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        user: true,
        account: true,
      },
    });

    if (!claim) {
      return new NextResponse('Claim not found', { status: 404 });
    }

    // Initialize PDF Document
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Create Page 1 (A4 size: 595 x 842 points)
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();

    // Draw Sleek Header Banner
    page.drawRectangle({
      x: 40,
      y: height - 90,
      width: width - 80,
      height: 50,
      color: rgb(0.12, 0.15, 0.27), // Deep navy matching app card theme
    });

    page.drawText('EXPENSE CLAIM REPORT', {
      x: 55,
      y: height - 73,
      size: 16,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    const nowStr = new Date().toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    page.drawText(`Generated: ${nowStr}`, {
      x: width - 240,
      y: height - 71,
      size: 8,
      font: helvetica,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Draw structured Claim Details Grid
    let y = height - 140;

    const drawRow = (label: string, value: string, isBigAmount = false, isStatus = false, statusVal = '') => {
      // Draw Label
      page.drawText(label, {
        x: 45,
        y: y + 5,
        size: 9.5,
        font: helveticaBold,
        color: rgb(0.4, 0.45, 0.5),
      });

      // Draw Value
      if (isBigAmount) {
        page.drawText(value, {
          x: 180,
          y: y + 3,
          size: 13,
          font: helveticaBold,
          color: rgb(0.44, 0.35, 0.95), // Violet primary
        });
      } else if (isStatus) {
        let badgeColor = rgb(0.85, 0.65, 0.1); // PENDING - Gold/Amber
        if (statusVal === 'APPROVED') badgeColor = rgb(0.1, 0.55, 0.25); // APPROVED - Green
        if (statusVal === 'REJECTED') badgeColor = rgb(0.75, 0.15, 0.15); // REJECTED - Red

        // Badge border background
        page.drawRectangle({
          x: 180,
          y: y + 2,
          width: 70,
          height: 15,
          color: badgeColor,
        });

        page.drawText(statusVal, {
          x: 180 + 35 - (helveticaBold.widthOfTextAtSize(statusVal, 8) / 2), // Centered text inside badge
          y: y + 6,
          size: 8,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });
      } else {
        page.drawText(value, {
          x: 180,
          y: y + 5,
          size: 9.5,
          font: helvetica,
          color: rgb(0.1, 0.1, 0.1),
        });
      }

      // Divider Line
      page.drawLine({
        start: { x: 40, y },
        end: { x: width - 40, y },
        thickness: 0.5,
        color: rgb(0.85, 0.88, 0.9),
      });

      y -= 26;
    };

    drawRow('Claim ID:', claim.id);
    drawRow('Employee Name:', `${claim.user.name} (@${claim.user.username})`);
    drawRow('Claim Category:', claim.claimType === 'PAYROLL' ? 'Site Allowance (Payroll)' : 'Expense Claim');
    drawRow('Supplier / Vendor:', claim.supplierName);
    drawRow('Reference Number:', claim.referenceNumber);
    drawRow('Expense Date:', new Date(claim.date).toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' }));
    drawRow('Account Category:', `${claim.account.code} - ${claim.account.name}`);
    drawRow('Amount Claimed:', `RM ${claim.amount.toFixed(2)}`, true);
    drawRow('Claim Status:', '', false, true, claim.status);

    // Item Description Block
    y -= 15;
    page.drawText('Item Description & Business Justification', {
      x: 40,
      y: y + 5,
      size: 11,
      font: helveticaBold,
      color: rgb(0.12, 0.15, 0.27),
    });

    y -= 15;
    const descBoxHeight = 160;
    const descBoxY = y - descBoxHeight;

    page.drawRectangle({
      x: 40,
      y: descBoxY,
      width: width - 80,
      height: descBoxHeight,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.85, 0.88, 0.9),
      borderWidth: 1,
    });

    const maxTextWidth = width - 110;
    const paragraphs = claim.itemDescription.split('\n');
    const wrappedLines: string[] = [];
    for (const p of paragraphs) {
      if (p.trim() === '') {
        wrappedLines.push('');
      } else {
        wrappedLines.push(...wrapText(p, maxTextWidth, 9.5, helvetica));
      }
    }

    let textY = y - 18;
    for (const line of wrappedLines) {
      if (textY < descBoxY + 15) {
        page.drawText('... [description truncated in PDF]', {
          x: 55,
          y: textY,
          size: 9,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        });
        break;
      }
      if (line !== '') {
        page.drawText(line, {
          x: 55,
          y: textY,
          size: 9.5,
          font: helvetica,
          color: rgb(0.15, 0.15, 0.15),
        });
      }
      textY -= 14;
    }

    // Append Receipt File if attached
    if (claim.receiptUrl) {
      const receiptPath = join(process.cwd(), 'public', claim.receiptUrl);
      try {
        const fileStats = await stat(receiptPath);
        if (fileStats.isFile()) {
          const receiptBuffer = await readFile(receiptPath);
          const urlLower = claim.receiptUrl.toLowerCase();

          if (urlLower.endsWith('.pdf')) {
            // Load and copy pages of the uploaded PDF receipt
            const srcPdf = await PDFDocument.load(receiptBuffer);
            const copiedPages = await pdfDoc.copyPages(srcPdf, srcPdf.getPageIndices());
            copiedPages.forEach((p) => {
              pdfDoc.addPage(p);
            });
          } else if (
            urlLower.endsWith('.png') ||
            urlLower.endsWith('.jpg') ||
            urlLower.endsWith('.jpeg')
          ) {
            // Embed PNG or JPG receipt image
            let img;
            if (urlLower.endsWith('.png')) {
              img = await pdfDoc.embedPng(receiptBuffer);
            } else {
              img = await pdfDoc.embedJpg(receiptBuffer);
            }

            const imgDims = img.scale(1);
            const imagePage = pdfDoc.addPage([595, 842]);
            const { width: pW, height: pH } = imagePage.getSize();

            const margin = 40;
            const maxW = pW - margin * 2;
            const maxH = pH - margin * 2 - 30; // Extra room at bottom for footer

            const scale = Math.min(maxW / imgDims.width, maxH / imgDims.height);
            const finalW = imgDims.width * scale;
            const finalH = imgDims.height * scale;

            imagePage.drawImage(img, {
              x: (pW - finalW) / 2,
              y: (pH - finalH) / 2 + 15,
              width: finalW,
              height: finalH,
            });
          }
        }
      } catch (err) {
        console.error('Failed to append receipt file:', err);
        const errPage = pdfDoc.addPage([595, 842]);
        errPage.drawText('ERROR: Receipt attachment could not be compiled.', {
          x: 50,
          y: 420,
          size: 13,
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

    // Dynamic Page Numbering & Footer across all pages
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const { width: pW } = p.getSize();

      p.drawText(`Office Expense Claim System - Report ID: ${claim.id.substring(0, 8)}`, {
        x: 40,
        y: 20,
        size: 7.5,
        font: helvetica,
        color: rgb(0.5, 0.55, 0.6),
      });

      p.drawText(`Page ${i + 1} of ${pages.length}`, {
        x: pW - 95,
        y: 20,
        size: 7.5,
        font: helvetica,
        color: rgb(0.5, 0.55, 0.6),
      });
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes) as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="claim_report_${claim.id}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Report generation error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
