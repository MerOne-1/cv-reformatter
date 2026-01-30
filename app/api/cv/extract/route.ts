import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { downloadFile } from '@/lib/b2';
import { askLLM } from '@/lib/llm';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from '@/lib/prompts/extraction';
import { detectMissingFields } from '@/lib/types';
import { getFileExtension, extractConsultantNameFromFilename } from '@/lib/utils';
import { z } from 'zod';

// Dynamic imports for file parsers
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const officeparser = await import('officeparser');
  return officeparser.parseOfficeAsync(buffer) as Promise<string>;
}

const extractSchema = z.object({
  cvId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvId } = extractSchema.parse(body);

    // Get CV from database
    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
    });

    if (!cv) {
      return NextResponse.json(
        { success: false, error: 'CV not found' },
        { status: 404 }
      );
    }

    // Download file from B2
    const fileBuffer = await downloadFile(cv.originalKey);
    const extension = getFileExtension(cv.originalName);

    // Extract text based on file type
    let rawText: string;
    if (extension === 'pdf') {
      rawText = await extractTextFromPDF(fileBuffer);
    } else if (extension === 'docx' || extension === 'doc') {
      rawText = await extractTextFromDOCX(fileBuffer);
    } else {
      return NextResponse.json(
        { success: false, error: 'Unsupported file format' },
        { status: 400 }
      );
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        { success: false, error: 'Could not extract text from file' },
        { status: 400 }
      );
    }

    // Use LLM to structure the content
    const markdownContent = await askLLM(
      EXTRACTION_SYSTEM_PROMPT,
      EXTRACTION_USER_PROMPT(rawText)
    );

    // Detect missing fields
    const missingFields = detectMissingFields(markdownContent);

    // Extract consultant name from markdown (first H1)
    const nameMatch = markdownContent.match(/^#\s+(.+)$/m);
    const consultantName =
      nameMatch?.[1] || extractConsultantNameFromFilename(cv.originalName);

    // Extract title (first H2 after "Titre professionnel")
    const titleMatch = markdownContent.match(
      /##\s+Titre professionnel\s*\n+(.+)/
    );
    const title = titleMatch?.[1]?.trim() || null;

    // Update CV in database
    const updatedCV = await prisma.cV.update({
      where: { id: cvId },
      data: {
        markdownContent,
        consultantName,
        title,
        missingFields,
        status: 'EXTRACTED',
        extractedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedCV.id,
        markdownContent: updatedCV.markdownContent,
        consultantName: updatedCV.consultantName,
        title: updatedCV.title,
        missingFields: updatedCV.missingFields,
        status: updatedCV.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error extracting CV:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract CV',
      },
      { status: 500 }
    );
  }
}
