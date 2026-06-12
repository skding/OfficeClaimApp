import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
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

    const where: {
      status: string;
      userId?: string;
      date?: { gte?: Date; lte?: Date };
    } = {
      status: 'APPROVED',
    };

    if (userId) where.userId = userId;

    if (startDateStr || endDateStr) {
      where.date = {};
      if (startDateStr) where.date.gte = new Date(startDateStr);
      if (endDateStr) where.date.lte = new Date(endDateStr);
    }

    const claims = await prisma.claim.findMany({
      where,
      include: { account: true, user: true },
      orderBy: { date: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    if (templateType === 'simple') {
      // ─── SIMPLE TEMPLATE ────────────────────────────────────────────────────
      // Columns (A–L):
      //   A: row marker (#/$/ )
      //   B: Employee *
      //   C: Reference No.
      //   D: Date *          (DD/MM/YYYY)
      //   E: Due Date        (DD/MM/YYYY)
      //   F: Currency
      //   G: Rate
      //   H: Account *
      //   I: Item Description *
      //   J: Amount *
      //   K: Tax
      //   L: Classification Code

      // Comment rows
      const comments = [
        ['#', 'TEMPLATE FOR BILLS (EXPENSE CLAIM) - SIMPLE MODE - MY'],
        ['#', ''],
        ['#', 'INSTRUCTIONS FOR IMPORT (PLEASE READ FIRST)'],
        ['#', "Lines that start with '#' are comments and will be ignored by the system during import."],
        ['#', "DO NOT remove the line started with '$', the system requires it to identify the columns."],
        ['#', "DO NOT remove the first column with '#' and '$', system will read data from 2nd column."],
        ['#', "Fields marked with '*' are required."],
        ['#', "Fields marked with '+' are conditionally required."],
        ['#', '- To create a transaction with more than one line item, you can either:'],
        ['#', '    > Add additional lines with the same data in the columns before column H.'],
        ['#', '    > Add additional lines with all columns left blank before column H.'],
        ['#', ''],
        ['#', 'NOTES:'],
        ['#', '(D) Accepted format for dates is "DD/MM/YYYY".'],
        ['#', "(1) The employee for the expense claim, use the Contact's legal name from your Bukku account."],
        ['#', "(2) The transaction's due date, default to the transaction's Date if left blank."],
        ['#', "(3) The transaction's currency, enter the 3 character ISO currency code (eg. MYR), default to home currency if left blank."],
        ['#', "(4) The transaction's exchange rate used to convert the amount into home currency, default to 1 if left blank."],
        ['#', "(5) The line item's account, enter the Account's code."],
        ['#', "(6) The purchase tax applicable for the line item, enter the Tax's code."],
        ['#', '(7) The classification code, used for MyInvois submission (Malaysia only).'],
        ['#', ''],
      ];
      for (const c of comments) sheet.addRow(c);

      // $ header row
      sheet.addRow([
        '$',
        'Employee (1) *',
        'Reference No.',
        'Date (D) *',
        'Due Date (D) (2)',
        'Currency (3)',
        'Rate (4)',
        'Account (5) *',
        'Item Description *',
        'Amount *',
        'Tax (6)',
        'Classification Code (7)',
      ]);

      // Data rows
      for (const claim of claims) {
        const employeeName = claim.user.name || claim.user.username;
        const dateStr = formatDate(claim.date);
        sheet.addRow([
          '',                          // A: blank (not # or $)
          employeeName,               // B: Employee
          claim.referenceNumber || '',// C: Reference No.
          dateStr,                    // D: Date
          '',                         // E: Due Date (blank = defaults to Date)
          'MYR',                      // F: Currency
          '',                         // G: Rate (blank = 1)
          claim.account.code,         // H: Account code
          claim.itemDescription,      // I: Item Description
          claim.amount.toFixed(2),    // J: Amount
          '',                         // K: Tax (blank = none)
          '',                         // L: Classification Code
        ]);
      }

    } else {
      // ─── EXTENDED TEMPLATE ──────────────────────────────────────────────────
      // Columns (A–V):
      //   A: row marker (#/$/ )
      //   B: Employee *
      //   C: Supplier
      //   D: No. (expense claim number)
      //   E: Reference No.
      //   F: Date *          (DD/MM/YYYY)
      //   G: Payment Term
      //   H: Due Date        (DD/MM/YYYY)
      //   I: Currency
      //   J: Rate
      //   K: Tags
      //   L: Description
      //   M: Product
      //   N: Account *
      //   O: Item Description *
      //   P: Quantity
      //   Q: UOM
      //   R: Location
      //   S: Unit Price *
      //   T: Discount
      //   U: Tax
      //   V: Classification Code

      const comments = [
        ['#', 'TEMPLATE FOR BILLS (EXPENSE CLAIM) - EXTENDED MODE - MY'],
        ['#', ''],
        ['#', 'INSTRUCTIONS FOR IMPORT (PLEASE READ FIRST)'],
        ['#', "Lines that start with '#' are comments and will be ignored by the system during import."],
        ['#', "DO NOT remove the line started with '$', the system requires it to identify the columns."],
        ['#', "DO NOT remove the first column with '#' and '$', system will read data from 2nd column."],
        ['#', "Fields marked with '*' are required."],
        ['#', "Fields marked with '+' are conditionally required."],
        ['#', '- To create a transaction with more than one line item, you can either:'],
        ['#', '    > Add additional lines with the same data in the columns before column M.'],
        ['#', '    > Add additional lines with all columns left blank before column M.'],
        ['#', ''],
        ['#', 'NOTES:'],
        ['#', '(D) Accepted format for dates is "DD/MM/YYYY".'],
        ['#', "(1) The employee for the expense claim, use the Contact's legal name from your Bukku account."],
        ['#', "(2) The supplier for the expense claim, use the Contact's legal name from your Bukku account."],
        ['#', "(3) The transaction's unique number, enter the actual number or a number format with number placeholder (eg. IV-[5DIGIT]) for automated running number, default number format is used if left blank."],
        ['#', "(4) The transaction's payment term, enter the Payment Term's name (eg. NET30), you may leave blank to set a Due Date."],
        ['#', "(5) The transaction's due date, only use this if Payment Term is not provided, default to the transaction's Date if left blank."],
        ['#', "(6) The transaction's currency, enter the 3 character ISO currency code (eg. MYR), default to home currency if left blank."],
        ['#', "(7) The transaction's exchange rate used to convert the amount into home currency, default to 1 if left blank."],
        ['#', "(8) Assign the transaction to multiple tags, enter the Tag's name and you may specific multiple tags with commas."],
        ['#', "(9) The line item's product, enter the Product's name."],
        ['#', "(10) The line item's account, enter the Account's code."],
        ['#', "(11) The line item's quantity, default to 1 if left blank."],
        ['#', "(12) The line item's product UOM (Unit of Measurements), only used when product is selected, it will set to the default / base UOM if left blank."],
        ['#', "(13) The line item's product location, enter the Location's code, only used when inventory product is selected, it will set to default location if left blank."],
        ['#', "(14) The line item's discount, enter amount value (eg. 5.00) or percentage value (eg. 5%)."],
        ['#', "(15) The purchase tax applicable for the line item, enter the Tax's code."],
        ['#', '(16) The classification code, used for MyInvois submission (Malaysia only).'],
        ['#', ''],
      ];
      for (const c of comments) sheet.addRow(c);

      // $ header row
      sheet.addRow([
        '$',
        'Employee (1) *',
        'Supplier (2)',
        'No. (3)',
        'Reference No.',
        'Date (D) *',
        'Payment Term (4)',
        'Due Date (D) (5)',
        'Currency (6)',
        'Rate (7)',
        'Tags (8)',
        'Description',
        'Product (9)',
        'Account (10) *',
        'Item Description *',
        'Quantity (11)',
        'UOM (12)',
        'Location (13)',
        'Unit Price *',
        'Discount (14)',
        'Tax (15)',
        'Classification Code (16)',
      ]);

      // Data rows
      for (const claim of claims) {
        const employeeName = claim.user.name || claim.user.username;
        const dateStr = formatDate(claim.date);
        sheet.addRow([
          '',                             // A: blank
          employeeName,                   // B: Employee
          claim.supplierName || '',       // C: Supplier
          '',                             // D: No. (blank = Bukku auto-generates)
          claim.referenceNumber || '',    // E: Reference No.
          dateStr,                        // F: Date
          '',                             // G: Payment Term (blank = use Due Date)
          '',                             // H: Due Date (blank = defaults to Date)
          'MYR',                          // I: Currency
          '',                             // J: Rate (blank = 1)
          '',                             // K: Tags
          '',                             // L: Description (transaction-level)
          '',                             // M: Product
          claim.account.code,             // N: Account code
          claim.itemDescription,          // O: Item Description
          '',                             // P: Quantity (blank = 1)
          '',                             // Q: UOM
          '',                             // R: Location
          claim.amount.toFixed(2),        // S: Unit Price
          '',                             // T: Discount
          '',                             // U: Tax
          '',                             // V: Classification Code
        ]);
      }
    }

    // Serialise to buffer and return as .xlsx download
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="bukku_expense_claims_${templateType}_${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export claims error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
