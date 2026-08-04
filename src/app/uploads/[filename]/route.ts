import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Sanitize filename to prevent path traversal
    const decodedFilename = decodeURIComponent(filename);
    const safeFilename = decodedFilename.replace(/^(\.\.[\/\\])+/, '').replace(/[\/\\]/g, '');

    const filePath = join(process.cwd(), 'public', 'uploads', safeFilename);

    // Verify file exists
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      return new NextResponse('File not found', { status: 404 });
    }

    const fileBuffer = await readFile(filePath);

    // Determine mime type
    let mimeType = 'application/octet-stream';
    const ext = safeFilename.split('.').pop()?.toLowerCase();
    
    if (ext === 'pdf') {
      mimeType = 'application/pdf';
    } else if (ext === 'png') {
      mimeType = 'image/png';
    } else if (ext === 'jpg' || ext === 'jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === 'webp') {
      mimeType = 'image/webp';
    } else if (ext === 'gif') {
      mimeType = 'image/gif';
    } else if (ext === 'svg') {
      mimeType = 'image/svg+xml';
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': ext === 'pdf' ? `inline; filename="${safeFilename}"` : 'inline',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving upload:', error);
    return new NextResponse('File not found', { status: 404 });
  }
}
