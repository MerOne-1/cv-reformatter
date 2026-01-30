import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, getRawCVKey } from '@/lib/b2';
import prisma from '@/lib/db';
import { isValidCVFile } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!isValidCVFile(file.name)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only PDF, DOC, DOCX are allowed.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to B2
    const key = getRawCVKey(file.name);
    const url = await uploadFile(key, buffer, file.type);

    // Create CV entry in database
    const cv = await prisma.cV.create({
      data: {
        originalName: file.name,
        originalKey: key,
        originalUrl: url,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: cv.id,
        originalName: cv.originalName,
        status: cv.status,
      },
    });
  } catch (error) {
    console.error('Error uploading CV:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload CV',
      },
      { status: 500 }
    );
  }
}
