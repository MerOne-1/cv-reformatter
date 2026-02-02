import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, getRawCVKey } from '@/lib/b2';
import prisma from '@/lib/db';
import { isValidCVFile, getFileExtension, validateCVMagicBytes } from '@/lib/utils';
import { randomUUID } from 'crypto';

// Limite de taille de fichier: 10 Mo
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const errorId = randomUUID().slice(0, 8);

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

    // Validation de la taille du fichier
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10 MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate magic bytes to ensure file content matches extension
    const extension = getFileExtension(file.name);
    if (!validateCVMagicBytes(buffer, extension)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file content. File does not match expected format.' },
        { status: 400 }
      );
    }

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
    console.error(`Error uploading CV [${errorId}]:`, error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload CV',
        errorId,
      },
      { status: 500 }
    );
  }
}
