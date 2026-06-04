import { NextResponse } from 'next/server';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us';
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

    // If configuration is missing, return a user-friendly mock details for dev testing
    if (!projectId || !processorId) {
      console.warn('Document AI is not configured. Returning mock details.');
      // For developer convenience, when not configured, let's return mock parsed data
      // so they can test the UI flow immediately without setting up GCP!
      return NextResponse.json({
        supplierName: 'Apple Store Malaysia',
        referenceNumber: 'TAX-9988122-MY',
        date: new Date().toISOString().split('T')[0],
        amount: 349.00,
        itemDescription: 'Apple Pencil Pro for designers office',
        isMock: true,
      });
    }

    const clientOptions: { credentials?: Record<string, unknown> } = {};
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        clientOptions.credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) as Record<string, unknown>;
      } catch {
        console.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON');
      }
    }

    const client = new DocumentProcessorServiceClient(clientOptions);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    const docAiRequest = {
      name,
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType: file.type || 'application/pdf',
      },
    };

    const [result] = await client.processDocument(docAiRequest);
    const { document } = result;

    if (!document || !document.entities) {
      return NextResponse.json({ error: 'Failed to extract document entities' }, { status: 422 });
    }

    // Helper to find entity value by type
    const findEntity = (type: string) => {
      const entity = document.entities?.find((e) => e.type === type);
      return entity ? entity.mentionText || entity.normalizedValue?.text : null;
    };

    // Document AI Expense Parser entities:
    // supplier_name, receipt_date, total_amount, invoice_id, line_item, etc.
    const supplierName = findEntity('supplier_name') || findEntity('vendor_name') || '';
    const referenceNumber = findEntity('invoice_id') || findEntity('receipt_number') || findEntity('doc_id') || '';
    const rawDate = findEntity('receipt_date') || findEntity('invoice_date') || findEntity('date') || '';
    const rawAmount = findEntity('total_amount') || findEntity('net_amount') || '';

    // Clean up amount
    let amount: number | null = null;
    if (rawAmount) {
      const cleanAmt = rawAmount.replace(/[^0-9.]/g, '');
      const parsedAmt = parseFloat(cleanAmt);
      if (!isNaN(parsedAmt)) {
        amount = parsedAmt;
      }
    }

    // Clean up date to standard YYYY-MM-DD if possible
    let dateStr = '';
    if (rawDate) {
      try {
        const dateObj = new Date(rawDate);
        if (!isNaN(dateObj.getTime())) {
          dateStr = dateObj.toISOString().split('T')[0];
        }
      } catch {
        // Fallback to rawDate string
        dateStr = rawDate;
      }
    }

    // Extract item descriptions or concatenate line items
    let itemDescription = '';
    const lineItems = document.entities.filter((e) => e.type === 'line_item');
    if (lineItems && lineItems.length > 0) {
      const descriptions: string[] = [];
      lineItems.forEach((li) => {
        const descEntity = li.properties?.find((p) => p.type === 'line_item/description');
        if (descEntity && descEntity.mentionText) {
          descriptions.push(descEntity.mentionText);
        }
      });
      if (descriptions.length > 0) {
        itemDescription = descriptions.join(', ');
      }
    }

    if (!itemDescription) {
      itemDescription = findEntity('description') || 'Scanned expense item';
    }

    return NextResponse.json({
      supplierName,
      referenceNumber,
      date: dateStr,
      amount,
      itemDescription,
      isMock: false,
    });
  } catch (error) {
    const err = error as Error;
    console.error('Scan receipt error:', err);
    return NextResponse.json({ error: err.message || 'Data extraction failed' }, { status: 500 });
  }
}
