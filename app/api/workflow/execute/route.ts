import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { getWorkflowOrchestrationQueue } from '@/lib/queue';

const executeSchema = z.object({
  cvId: z.string().min(1),
  additionalContext: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = executeSchema.parse(body);

    const cv = await prisma.cV.findUnique({
      where: { id: data.cvId },
      select: { id: true, markdownContent: true, status: true },
    });

    if (!cv) {
      return NextResponse.json(
        { success: false, error: 'CV introuvable' },
        { status: 404 }
      );
    }

    if (!cv.markdownContent) {
      return NextResponse.json(
        { success: false, error: 'Le CV doit être extrait avant de lancer un workflow' },
        { status: 400 }
      );
    }

    const activeAgents = await prisma.aIAgent.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (activeAgents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Aucun agent actif configuré' },
        { status: 400 }
      );
    }

    const execution = await prisma.workflowExecution.create({
      data: {
        cvId: data.cvId,
        status: 'PENDING',
        inputData: data.additionalContext
          ? JSON.stringify({ additionalContext: data.additionalContext })
          : null,
      },
    });

    const queue = getWorkflowOrchestrationQueue();
    await queue.add(
      'orchestrate-workflow',
      {
        executionId: execution.id,
        cvId: data.cvId,
        additionalContext: data.additionalContext,
      },
      {
        jobId: `workflow-${execution.id}`,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        executionId: execution.id,
        status: execution.status,
        message: 'Workflow lancé avec succès',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error executing workflow:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du lancement du workflow' },
      { status: 500 }
    );
  }
}
