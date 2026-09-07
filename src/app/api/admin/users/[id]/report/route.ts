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
          // If the word by itself is wider than maxWidth, break it down
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
          // currentLine is empty and single word is wider than maxWidth
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
      isArchived: false,
    };

    if (startDateStr || endDateStr) {
      where.date = {};
      if (startDateStr) {
        where.date.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        // Include full day
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

    // Initialize PDF Document
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Create Page 1 (A4 size: 595 x 842 points)
    let page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();

    // Draw Sleek Header Banner
    page.drawRectangle({
      x: 40,
      y: height - 95,
      width: width - 80,
      height: 55,
      color: rgb(0.12, 0.15, 0.27),
    });

    page.drawText('EMPLOYEE CLAIMS SUMMARY REPORT', {
      x: 55,
      y: height - 72,
      size: 14,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    let rangeStr = 'All Active Approved Claims';
    if (startDateStr && endDateStr) {
      rangeStr = `Date Period: ${startDateStr} to ${endDateStr}`;
    } else if (startDateStr) {
      rangeStr = `Date Period: Since ${startDateStr}`;
    } else if (endDateStr) {
      rangeStr = `Date Period: Until ${endDateStr}`;
    }

    page.drawText(rangeStr, {
      x: 55,
      y: height - 88,
      size: 9,
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

    page.drawText(`Generated: ${nowStr}`, {
      x: width - 220,
      y: height - 72,
      size: 8,
      font: helvetica,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Draw Employee profile card
    page.drawRectangle({
      x: 40,
      y: height - 150,
      width: width - 80,
      height: 45,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: rgb(0.85, 0.88, 0.9),
      borderWidth: 1,
    });

    page.drawText('EMPLOYEE PROFILE:', { x: 50, y: height - 120, size: 8, font: helveticaBold, color: rgb(0.4, 0.45, 0.5) });
    page.drawText(`Name: ${employee.name || employee.username}`, { x: 50, y: height - 134, size: 10, font: helveticaBold, color: rgb(0.1, 0.1, 0.15) });
    page.drawText(`Username: @${employee.username}`, { x: 50, y: height - 144, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });

    page.drawText(`Approved Claims: ${claims.length}`, { x: width - 240, y: height - 130, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
    const totalAmountSum = claims.reduce((sum, c) => sum + c.amount, 0);
    page.drawText(`Total Amount: RM ${totalAmountSum.toFixed(2)}`, { x: width - 240, y: height - 144, size: 10, font: helveticaBold, color: rgb(0.44, 0.35, 0.95) });

    // Table coordinates & helpers
    let currentY = height - 180;

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
      page.drawText('No active approved claims found for this employee matching the filter criteria.', {
        x: 50,
        y: currentY - 30,
        size: 10,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    } else {
      drawHeaders(page, currentY);
      currentY -= 20;

      let currentPage = page;

      for (let i = 0; i < claims.length; i++) {
        const claim = claims[i];

        // Format metadata fields with multi-line wrapping
        const claimDateStr = new Date(claim.date).toLocaleDateString('en-MY', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const supplierLines = wrapText(claim.supplierName || '-', 110, 8, helvetica);
        const refLines = wrapText(claim.referenceNumber || '-', 95, 8, helvetica);
        const catLines = wrapText(`${claim.account.code} - ${claim.account.name}`, 120, 8, helvetica);
        const amtStr = `RM ${claim.amount.toFixed(2)}`;

        // Row 1 (Info) dimensions
        const row1LinesCount = Math.max(supplierLines.length, refLines.length, catLines.length, 1);
        const row1Height = row1LinesCount * 11 + 4;

        // Row 2 (Description) dimensions
        const descLines = wrapText(claim.itemDescription || '-', 445, 7.5, helvetica);
        const row2Height = descLines.length * 9.5 + 4;

        // Total 2-row item height
        const itemBlockHeight = row1Height + row2Height + 4;

        // Page overflow check before drawing this item
        if (currentY - itemBlockHeight < 65) {
          currentPage = pdfDoc.addPage([595, 842]);
          currentY = height - 60;
          drawHeaders(currentPage, currentY);
          currentY -= 20;
        }

        // Alternating row background for entire 2-row item block
        const isAltRow = i % 2 === 1;
        if (isAltRow) {
          currentPage.drawRectangle({
            x: 40,
            y: currentY - itemBlockHeight + 2,
            width: 515,
            height: itemBlockHeight - 2,
            color: rgb(0.96, 0.97, 0.99),
          });
        }

        // --- ROW 1: Claim Metadata ---
        const row1TopY = currentY - 9;

        // Date
        currentPage.drawText(claimDateStr, {
          x: 45,
          y: row1TopY,
          size: 8,
          font: helvetica,
          color: rgb(0.15, 0.15, 0.15),
        });

        // Supplier (Multi-line)
        supplierLines.forEach((line, idx) => {
          currentPage.drawText(line, {
            x: 110,
            y: row1TopY - idx * 11,
            size: 8,
            font: helvetica,
            color: rgb(0.15, 0.15, 0.15),
          });
        });

        // Ref Number (Multi-line)
        refLines.forEach((line, idx) => {
          currentPage.drawText(line, {
            x: 225,
            y: row1TopY - idx * 11,
            size: 8,
            font: helvetica,
            color: rgb(0.15, 0.15, 0.15),
          });
        });

        // Category (Multi-line)
        catLines.forEach((line, idx) => {
          currentPage.drawText(line, {
            x: 325,
            y: row1TopY - idx * 11,
            size: 8,
            font: helvetica,
            color: rgb(0.15, 0.15, 0.15),
          });
        });

        // Amount
        currentPage.drawText(amtStr, {
          x: 450,
          y: row1TopY,
          size: 8.5,
          font: helveticaBold,
          color: rgb(0.12, 0.15, 0.27),
        });

        // --- ROW 2: Item Description (Spanning width) ---
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

        // Item bottom separator line
        currentPage.drawLine({
          start: { x: 40, y: currentY - itemBlockHeight },
          end: { x: 555, y: currentY - itemBlockHeight },
          thickness: 0.5,
          color: rgb(0.85, 0.88, 0.9),
        });

        currentY -= itemBlockHeight + 2;
      }

      // Draw Total block
      if (currentY < 90) {
        currentPage = pdfDoc.addPage([595, 842]);
        currentY = height - 60;
      }

      currentY -= 10;
      currentPage.drawRectangle({
        x: 40,
        y: currentY - 8,
        width: 515,
        height: 22,
        color: rgb(0.92, 0.93, 0.97),
      });

      currentPage.drawText('TOTAL CLAIMS APPROVED:', {
        x: 48,
        y: currentY,
        size: 9,
        font: helveticaBold,
        color: rgb(0.12, 0.15, 0.27),
      });

      const totalAmtText = `RM ${totalAmountSum.toFixed(2)}`;
      currentPage.drawText(totalAmtText, {
        x: 450,
        y: currentY,
        size: 9.5,
        font: helveticaBold,
        color: rgb(0.44, 0.35, 0.95),
      });

      // Signature approval section
      currentY -= 65;
      if (currentY < 100) {
        currentPage = pdfDoc.addPage([595, 842]);
        currentY = height - 100;
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

    // Append individual receipt attachments with custom Separator pages
    for (const claim of claims) {
      if (claim.receiptUrl) {
        const receiptPath = join(process.cwd(), 'public', claim.receiptUrl);
        try {
          const fileStats = await stat(receiptPath);
          if (fileStats.isFile()) {
            const receiptBuffer = await readFile(receiptPath);
            const urlLower = claim.receiptUrl.toLowerCase();

            // 1. Create formatted separator page for this specific receipt
            const sepPage = pdfDoc.addPage([595, 842]);

            sepPage.drawRectangle({
              x: 40,
              y: height - 120,
              width: width - 80,
              height: 60,
              color: rgb(0.12, 0.15, 0.27),
            });

            sepPage.drawText('RECEIPT ATTACHMENT DETAILS', {
              x: 55,
              y: height - 92,
              size: 14,
              font: helveticaBold,
              color: rgb(1, 1, 1),
            });

            sepPage.drawText(`Claim Transaction ID: ${claim.id}`, {
              x: 55,
              y: height - 110,
              size: 8.5,
              font: helvetica,
              color: rgb(0.8, 0.8, 0.8),
            });

            let sepY = height - 175;

            const drawSepRow = (label: string, val: string, isBig = false) => {
              sepPage.drawText(label, { x: 50, y: sepY, size: 9.5, font: helveticaBold, color: rgb(0.4, 0.45, 0.5) });
              sepPage.drawText(val, {
                x: 180,
                y: sepY,
                size: isBig ? 12 : 9.5,
                font: helveticaBold,
                color: isBig ? rgb(0.44, 0.35, 0.95) : rgb(0.1, 0.1, 0.15),
              });
              sepPage.drawLine({ start: { x: 40, y: sepY - 8 }, end: { x: width - 40, y: sepY - 8 }, thickness: 0.5, color: rgb(0.85, 0.88, 0.9) });
              sepY -= 28;
            };

            drawSepRow('Supplier / Vendor:', claim.supplierName);
            drawSepRow('Reference / Invoice No.:', claim.referenceNumber);
            drawSepRow('Date of Expense:', new Date(claim.date).toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' }));
            drawSepRow('Account Code Category:', `${claim.account.code} - ${claim.account.name}`);
            drawSepRow('Amount Claimed:', `RM ${claim.amount.toFixed(2)}`, true);

            sepY -= 15;
            sepPage.drawText('Business Justification & Description:', { x: 50, y: sepY, size: 9.5, font: helveticaBold, color: rgb(0.12, 0.15, 0.27) });
            sepY -= 15;

            const sepDescLines = wrapText(claim.itemDescription, width - 100, 9.5, helvetica);
            for (const line of sepDescLines) {
              if (sepY < 100) {
                sepPage.drawText('... [description truncated]', { x: 50, y: sepY, size: 9, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
                break;
              }
              sepPage.drawText(line, { x: 50, y: sepY, size: 9.5, font: helvetica, color: rgb(0.15, 0.15, 0.15) });
              sepY -= 14;
            }

            // 2. Append the actual receipt file (PDF or Image)
            if (urlLower.endsWith('.pdf')) {
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
              const maxH = pH - margin * 2 - 30;

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

    // Dynamic numbering and footer across all pages
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const { width: pW } = p.getSize();

      p.drawText(`Employee claims report summary: ${employee.name || employee.username}`, {
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
        'Content-Disposition': `inline; filename="employee_summary_report_${employee.username}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Employee report generation error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
