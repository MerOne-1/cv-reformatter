import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params;

  const execution = await prisma.workflowExecution.findUnique({
    where: { id: executionId },
    include: {
      steps: {
        include: {
          agent: {
            select: { name: true, displayName: true },
          },
        },
        orderBy: { startedAt: 'asc' },
      },
    },
  });

  if (!execution) {
    return NextResponse.json(
      { success: false, error: 'Exécution introuvable' },
      { status: 404 }
    );
  }

  const completedSteps = execution.steps.filter(s => s.status === 'COMPLETED').length;
  const totalSteps = execution.steps.length;

  return NextResponse.json({
    success: true,
    data: {
      id: execution.id,
      status: execution.status,
      error: execution.error,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      progress: {
        completed: completedSteps,
        total: totalSteps,
        percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      },
      steps: execution.steps.map(step => ({
        id: step.id,
        agentName: step.agent.name,
        agentDisplayName: step.agent.displayName,
        status: step.status,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        error: step.error,
      })),
    },
  });
}
