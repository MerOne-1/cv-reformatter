import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { downloadFile, renameFile, getRawCVKey } from '@/lib/b2';
import { askLLM } from '@/lib/llm';
import { getAgentPrompts, AgentNotFoundError, AgentInactiveError } from '@/lib/agents';
import { detectMissingFields } from '@/lib/types';
import { getFileExtension, extractConsultantNameFromFilename, generateRawFilename, getContentTypeForExtension } from '@/lib/utils';
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
  skipEnrichment: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvId, skipEnrichment } = extractSchema.parse(body);

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

    // Get extraction prompts from database
    const { system, user } = await getAgentPrompts('extraction', rawText);

    // Use LLM to structure the content
    const markdownContent = await askLLM(system, user);

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

    // Rename file in B2 with consultant full name
    let newOriginalName = cv.originalName;
    let newOriginalKey = cv.originalKey;
    let renameWarning: string | null = null;
    if (consultantName) {
      try {
        const baseFilename = generateRawFilename(consultantName, extension);
        const timestamp = Date.now().toString(36);
        const newFilename = baseFilename.replace(`.${extension}`, `_${timestamp}.${extension}`);
        const newKey = getRawCVKey(newFilename);
        const contentType = getContentTypeForExtension(extension);
        const { deleteError } = await renameFile(cv.originalKey, newKey, contentType);
        newOriginalName = newFilename;
        newOriginalKey = newKey;
        if (deleteError) {
          renameWarning = 'Le fichier a été renommé mais l\'ancien fichier n\'a pas pu être supprimé.';
        }
      } catch (renameError) {
        console.error('Failed to rename file in B2:', {
          cvId,
          originalKey: cv.originalKey,
          consultantName,
          error: renameError instanceof Error ? renameError.message : renameError,
        });
        renameWarning = 'Le fichier n\'a pas pu être renommé. Le nom original est conservé.';
      }
    }

    // Start with extracted content
    let finalMarkdown = markdownContent;
    let finalMissingFields = missingFields;
    const appliedAgents: string[] = ['extraction'];

    // Step 2: Apply enrichisseur (if not skipped)
    if (!skipEnrichment) {
      try {
        const { system: enrichSystem, user: enrichUser } = await getAgentPrompts(
          'enrichisseur',
          finalMarkdown
        );
        finalMarkdown = await askLLM(enrichSystem, enrichUser);
        finalMissingFields = detectMissingFields(finalMarkdown);
        appliedAgents.push('enrichisseur');
      } catch (err) {
        console.warn('Enrichisseur agent skipped:', err instanceof Error ? err.message : err);
      }
    }

    // Step 3: Apply contextualiseur with notes
    try {
      // Build context with user notes
      let contextForAgent: string | undefined;
      if (cv.notes) {
        contextForAgent = `--- Notes de l'utilisateur ---\n${cv.notes}\n---`;
      }

      const { system: ctxSystem, user: ctxUser } = await getAgentPrompts(
        'contexte',
        finalMarkdown,
        contextForAgent
      );
      finalMarkdown = await askLLM(ctxSystem, ctxUser);
      finalMissingFields = detectMissingFields(finalMarkdown);
      appliedAgents.push('contexte');
    } catch (err) {
      console.warn('Contexte agent skipped:', err instanceof Error ? err.message : err);
    }

    // Update CV in database
    const updatedCV = await prisma.cV.update({
      where: { id: cvId },
      data: {
        markdownContent: finalMarkdown,
        consultantName,
        title,
        missingFields: finalMissingFields,
        originalName: newOriginalName,
        originalKey: newOriginalKey,
        status: 'EXTRACTED',
        extractedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      warning: renameWarning,
      skipEnrichment,
      appliedAgents,
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

    if (error instanceof AgentNotFoundError || error instanceof AgentInactiveError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 503 }
      );
    }

    console.error('Error extracting CV:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Une erreur est survenue lors de l\'extraction du CV. Veuillez réessayer.',
      },
      { status: 500 }
    );
  }
}
