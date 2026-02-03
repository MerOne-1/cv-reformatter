import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { downloadFile, renameFile, getRawCVKey } from '@/lib/b2';
import { askLLM } from '@/lib/llm';
import { getAgentPrompts, AgentNotFoundError, AgentInactiveError } from '@/lib/agents';
import { detectMissingFields } from '@/lib/types';
import { getFileExtension, extractConsultantNameFromFilename, generateRawFilename, getContentTypeForExtension } from '@/lib/utils';
import { z } from 'zod';
import { apiRoute, error } from '@/lib/api-route';

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

export const POST = apiRoute()
  .body(extractSchema)
  .handler(async (_, { body }) => {
    const { cvId } = body;

    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
    });

    if (!cv) {
      return error('CV not found', 404);
    }

    const fileBuffer = await downloadFile(cv.originalKey);
    const extension = getFileExtension(cv.originalName);

    let rawText: string;
    if (extension === 'pdf') {
      rawText = await extractTextFromPDF(fileBuffer);
    } else if (extension === 'docx' || extension === 'doc') {
      rawText = await extractTextFromDOCX(fileBuffer);
    } else {
      return error('Unsupported file format', 400);
    }

    if (!rawText || rawText.trim().length < 50) {
      return error('Could not extract text from file', 400);
    }

    // Récupérer l'agent pour avoir son ID
    const agent = await prisma.aIAgent.findUnique({
      where: { name: 'extraction' },
      select: { id: true },
    });

    if (!agent) {
      return error('Agent "extraction" non trouvé', 503);
    }

    let system: string;
    let user: string;
    try {
      const prompts = await getAgentPrompts('extraction', { markdown: rawText });
      system = prompts.system;
      user = prompts.user;
    } catch (e) {
      if (e instanceof AgentNotFoundError || e instanceof AgentInactiveError) {
        return error(e.message, 503);
      }
      throw e;
    }

    // Mesurer la durée de l'appel LLM
    const startTime = Date.now();
    const markdownContent = await askLLM(system, user);
    const durationMs = Date.now() - startTime;

    // Créer le log détaillé de l'exécution
    await prisma.agentExecutionLog.create({
      data: {
        agentId: agent.id,
        cvId,
        systemPrompt: system,
        userPrompt: user,
        inputMarkdown: rawText,
        outputMarkdown: markdownContent,
        durationMs,
        success: true,
      },
    });

    const missingFields = detectMissingFields(markdownContent);

    const nameMatch = markdownContent.match(/^#\s+(.+)$/m);
    const consultantName =
      nameMatch?.[1] || extractConsultantNameFromFilename(cv.originalName);

    const titleMatch = markdownContent.match(
      /##\s+Titre professionnel\s*\n+(.+)/
    );
    const title = titleMatch?.[1]?.trim() || null;

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

    const updatedCV = await prisma.cV.update({
      where: { id: cvId },
      data: {
        markdownContent,
        consultantName,
        title,
        missingFields,
        originalName: newOriginalName,
        originalKey: newOriginalKey,
        status: 'EXTRACTED',
        extractedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      warning: renameWarning,
      data: {
        id: updatedCV.id,
        markdownContent: updatedCV.markdownContent,
        consultantName: updatedCV.consultantName,
        title: updatedCV.title,
        missingFields: updatedCV.missingFields,
        status: updatedCV.status,
      },
    });
  });
