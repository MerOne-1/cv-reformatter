import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAgentExecutionQueue, getWorkflowOrchestrationQueue } from '@/lib/queue';

type RouteParams = Promise<{ executionId: string }>;

export async function GET(
  _request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { executionId } = await params;

    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        cv: {
          select: {
            id: true,
            originalName: true,
            consultantName: true,
            status: true,
          },
        },
        steps: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
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

    const summary = {
      total: execution.steps.length,
      pending: execution.steps.filter((s) => s.status === 'PENDING').length,
      waitingInputs: execution.steps.filter((s) => s.status === 'WAITING_INPUTS').length,
      running: execution.steps.filter((s) => s.status === 'RUNNING').length,
      completed: execution.steps.filter((s) => s.status === 'COMPLETED').length,
      failed: execution.steps.filter((s) => s.status === 'FAILED').length,
      skipped: execution.steps.filter((s) => s.status === 'SKIPPED').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        ...execution,
        summary,
      },
    });
  } catch (error) {
    console.error('Error fetching execution:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { executionId } = await params;

    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        steps: {
          select: { jobId: true },
        },
      },
    });

    if (!execution) {
      return NextResponse.json(
        { success: false, error: 'Exécution introuvable' },
        { status: 404 }
      );
    }

    if (execution.status === 'COMPLETED' || execution.status === 'FAILED') {
      return NextResponse.json(
        { success: false, error: 'Cette exécution est déjà terminée' },
        { status: 400 }
      );
    }

    const agentQueue = getAgentExecutionQueue();
    const orchestratorQueue = getWorkflowOrchestrationQueue();

    const jobsToRemove = execution.steps
      .filter((s) => s.jobId)
      .map((s) => s.jobId!);

    for (const jobId of jobsToRemove) {
      try {
        const job = await agentQueue.getJob(jobId);
        if (job) {
          await job.remove();
        }
      } catch {
        console.warn(`Could not remove job ${jobId}`);
      }
    }

    try {
      const orchestratorJob = await orchestratorQueue.getJob(`workflow-${executionId}`);
      if (orchestratorJob) {
        await orchestratorJob.remove();
      }
    } catch {
      console.warn(`Could not remove orchestrator job for ${executionId}`);
    }

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        error: 'Annulé par l\'utilisateur',
      },
    });

    await prisma.workflowStep.updateMany({
      where: {
        executionId,
        status: { in: ['PENDING', 'WAITING_INPUTS', 'RUNNING'] },
      },
      data: {
        status: 'SKIPPED',
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: { cancelled: true },
    });
  } catch (error) {
    console.error('Error cancelling execution:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
