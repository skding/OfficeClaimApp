import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { join } from 'path';
import { existsSync } from 'fs';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// Format a JS Date as DD/MM/YYYY (required by Bukku)
function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const userId = searchParams.get('userId');
    const templateType = searchParams.get('template') || 'simple'; // 'simple' or 'extended'

    // Requirement 3: Only export expense claims, ignore payroll site allowance claims
    const where: any = {
      status: 'APPROVED',
      OR: [
        { claimType: 'EXPENSE' },
        { claimType: null }, // for backwards compatibility
      ],
    };

    if (userId) where.userId = userId;

    if (startDateStr || endDateStr) {
      where.date = {};
      if (startDateStr) where.date.gte = new Date(startDateStr);
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const claims = await prisma.claim.findMany({
      where,
      include: { account: true, user: true },
      orderBy: { date: 'asc' },
    });

    const isExtended = templateType === 'extended';
    const templateFileName = isExtended
      ? 'purchase-expense-claim-template-extended-my-v2.xlsx'
      : 'purchase-expense-claim-template-my-v2.xlsx';
    const templatePath = join(process.cwd(), templateFileName);

    const workbook = new ExcelJS.Workbook();

    if (existsSync(templatePath)) {
      // ─── LOAD OFFICIAL BUKKU V2 TEMPLATE ────────────────────────────────────
      await workbook.xlsx.readFile(templatePath);
      const sheet = workbook.worksheets[0];

      if (!isExtended) {
        // Simple v2: Header is at row 23. Sample data rows are 24-26.
        // Clear sample rows
        for (let r = 24; r <= 35; r++) {
          sheet.getRow(r).values = [];
        }

        let rowIndex = 24;
        for (const claim of claims) {
          const employeeName = claim.user.name || claim.user.username;
          const dateStr = formatDate(claim.date);
          const row = sheet.getRow(rowIndex++);
          row.values = [
            '',                          // A: blank
            '',                          // B: Employee Contact Code (1)
            employeeName,                // C: Employee Legal Name (2)
            claim.referenceNumber || '', // D: Reference No.
            dateStr,                     // E: Date (D) *
            '',                          // F: Due Date (D) (3)
            'MYR',                       // G: Currency (4)
            '',                          // H: Rate (5)
            claim.account.code,          // I: Account (6) *
            claim.itemDescription,       // J: Item Description *
            claim.amount.toFixed(2),     // K: Amount *
            '',                          // L: Tax (7)
            '',                          // M: Classification Code (8)
          ];
        }
      } else {
        // Extended v2: Header is at row 33. Sample data rows are 34-36.
        // Clear sample rows
        for (let r = 34; r <= 45; r++) {
          sheet.getRow(r).values = [];
        }

        let rowIndex = 34;
        for (const claim of claims) {
          const employeeName = claim.user.name || claim.user.username;
          const dateStr = formatDate(claim.date);
          const row = sheet.getRow(rowIndex++);
          row.values = [
            '',                             // A: blank
            '',                             // B: Employee Contact Code (1)
            employeeName,                   // C: Employee Legal Name (2)
            '',                             // D: Supplier Contact Code (3)
            claim.supplierName || '',       // E: Supplier Legal Name (4)
            '',                             // F: No. (5)
            claim.referenceNumber || '',    // G: Reference No.
            dateStr,                        // H: Date (D) *
            '',                             // I: Payment Term (6)
            '',                             // J: Due Date (D) (7)
            'MYR',                          // K: Currency (8)
            '',                             // L: Rate (9)
            '',                             // M: Tags (10)
            '',                             // N: Description
            '',                             // O: Product (11)
            claim.account.code,             // P: Account (12) *
            claim.itemDescription,          // Q: Item Description *
            '',                             // R: Quantity (13)
            '',                             // S: UOM (14)
            '',                             // T: Location (15)
            claim.amount.toFixed(2),        // U: Unit Price *
            '',                             // V: Discount (16)
            '',                             // W: Tax (17)
            '',                             // X: Classification Code (18)
          ];
        }
      }
    } else {
      // ─── FALLBACK: PROGRAMMATIC V2 STRUCTURE GENERATION ────────────────────
      const sheet = workbook.addWorksheet('Worksheet');

      if (!isExtended) {
        const comments = [
          ['#', 'TEMPLATE FOR BILLS (EXPENSE CLAIM) - SIMPLE MODE - MY'],
          ['#'],
          ['#', 'INSTRUCTIONS FOR IMPORT (PLEASE READ FIRST)'],
          ['#', "Lines that start with '#' are comments and will be ignored by the system during import."],
          ['#', "DO NOT remove the line started with '$', the system requires it to identify the columns."],
          ['#', "DO NOT remove the first column with '#' and '$', system will read data from 2nd column."],
          ['#', "Fields marked with '*' are required."],
          ['#', '- To create a transaction with more than one line item, you can either:'],
          ['#', '    > Add additional lines with the same data in the columns before column I.'],
          ['#', '    > Add additional lines with all columns left blank before column I.'],
          ['#'],
          ['#', 'NOTES:'],
          ['#', '(D) Accepted format for dates is "DD/MM/YYYY".'],
          ['#', "(1) The transaction's employee, enter the Contact's Contact Code (eg. C-A0001). If left blank, the employee will be matched by Legal Name instead (Column 2)."],
          ['#', "(2) The employee's Legal Name (e.g. Angeline Tan). Used to match the employee only if Contact Code is blank or doesn't match an existing code."],
          ['#', "(3) The transaction's due date, default to the transaction's Date if left blank."],
          ['#', "(4) The transaction's currency, enter the 3 character ISO currency code (eg. MYR), default to home currency if left blank."],
          ['#', "(5) The transaction's exchange rate used to convert the amount into home currency, default to 1 if left blank."],
          ['#', "(6) The line item's account, enter the Account's code."],
          ['#', "(7) The purchase tax applicable for the line item, enter the Tax's code."],
          ['#', '(8) The classification code, used for MyInvois submission (Malaysia only).'],
          ['#'],
        ];
        for (const c of comments) sheet.addRow(c);

        sheet.addRow([
          '#',
          'Employee Contact Code (1)',
          'Employee Legal Name (2)',
          'Reference No.',
          'Date (D) *',
          'Due Date (D) (3)',
          'Currency (4)',
          'Rate (5)',
          'Account (6) *',
          'Item Description *',
          'Amount *',
          'Tax (7)',
          'Classification Code (8)',
        ]);

        for (const claim of claims) {
          const employeeName = claim.user.name || claim.user.username;
          const dateStr = formatDate(claim.date);
          sheet.addRow([
            '',
            '',
            employeeName,
            claim.referenceNumber || '',
            dateStr,
            '',
            'MYR',
            '',
            claim.account.code,
            claim.itemDescription,
            claim.amount.toFixed(2),
            '',
            '',
          ]);
        }
      } else {
        const comments = [
          ['#', 'TEMPLATE FOR BILLS (EXPENSE CLAIM) - EXTENDED MODE - MY'],
          ['#'],
          ['#', 'INSTRUCTIONS FOR IMPORT (PLEASE READ FIRST)'],
          ['#', "Lines that start with '#' are comments and will be ignored by the system during import."],
          ['#', "DO NOT remove the line started with '$', the system requires it to identify the columns."],
          ['#', "DO NOT remove the first column with '#' and '$', system will read data from 2nd column."],
          ['#', "Fields marked with '*' are required."],
          ['#', '- To create a transaction with more than one line item, you can either:'],
          ['#', '    > Add additional lines with the same data in the columns before column O.'],
          ['#', '    > Add additional lines with all columns left blank before column O.'],
          ['#'],
          ['#', 'NOTES:'],
          ['#', '(D) Accepted format for dates is "DD/MM/YYYY".'],
          ['#', "(1) The transaction's employee, enter the Contact's Contact Code (eg. C-A0001). If left blank, the employee will be matched by Legal Name instead (Column 2)."],
          ['#', "(2) The employee's Legal Name (e.g. Angeline Tan). Used to match the employee only if Contact Code is blank or doesn't match an existing code."],
          ['#', "(3) The transaction's supplier, enter the Contact's Contact Code (eg. C-A0001). If left blank, the supplier will be matched by Legal Name instead (Column 4)."],
          ['#', "(4) The supplier's Legal Name (eg. Acme Sdn Bhd). Used to match the supplier only if Contact Code is blank or doesn't match an existing code."],
          ['#', "(5) The transaction's unique number, enter the actual number or a number format with number placeholder (eg. IV-[5DIGIT]) for automated running number, default number format is used if left blank."],
          ['#', "(6) The transaction's payment term, enter the Payment Term's name (eg. NET30), you may leave blank to set a Due Date."],
          ['#', "(7) The transaction's due date, only use this if Payment Term is not provided, default to the transaction's Date if left blank."],
          ['#', "(8) The transaction's currency, enter the 3 character ISO currency code (eg. MYR), default to home currency if left blank."],
          ['#', "(9) The transaction's exchange rate used to convert the amount into home currency, default to 1 if left blank."],
          ['#', "(10) Assign the transaction to multiple tags, enter the Tag's name and you may specific multiple tags with with commas."],
          ['#', "(11) The line item's product, enter the Product's name."],
          ['#', "(12) The line item's account, enter the Account's code."],
          ['#', "(13) The line item's quantity, default to 1 if left blank."],
          ['#', "(14) The line item's product UOM (Unit of Measurements), only used when product is selected, it will set to the default / base UOM if left blank."],
          ['#', "(15) The line item's product location, enter the Location's code, only used when inventory product is selected, it will set to default location if left blank."],
          ['#', "(16) The line item’s discount, enter amount value (eg. 5.00) or percentage value (eg. 5%)."],
          ['#', "(17) The purchase tax applicable for the line item, enter the Tax's code."],
          ['#', '(18) The classification code, used for MyInvois submission (Malaysia only).'],
          ['#'],
        ];
        for (const c of comments) sheet.addRow(c);

        sheet.addRow([
          '#',
          'Employee Contact Code (1)',
          'Employee Legal Name (2)',
          'Supplier Contact Code (3)',
          'Supplier Legal Name (4)',
          'No. (5)',
          'Reference No.',
          'Date (D) *',
          'Payment Term (6)',
          'Due Date (D) (7)',
          'Currency (8)',
          'Rate (9)',
          'Tags (10)',
          'Description',
          'Product (11)',
          'Account (12) *',
          'Item Description *',
          'Quantity (13)',
          'UOM (14)',
          'Location (15)',
          'Unit Price *',
          'Discount (16)',
          'Tax (17)',
          'Classification Code (18)',
        ]);

        for (const claim of claims) {
          const employeeName = claim.user.name || claim.user.username;
          const dateStr = formatDate(claim.date);
          sheet.addRow([
            '',
            '',
            employeeName,
            '',
            claim.supplierName || '',
            '',
            claim.referenceNumber || '',
            dateStr,
            '',
            '',
            'MYR',
            '',
            '',
            '',
            '',
            claim.account.code,
            claim.itemDescription,
            '',
            '',
            '',
            claim.amount.toFixed(2),
            '',
            '',
            '',
          ]);
        }
      }
    }

    // Serialise to buffer and return as .xlsx download
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="bukku_expense_claims_${templateType}_v2_${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export claims error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
