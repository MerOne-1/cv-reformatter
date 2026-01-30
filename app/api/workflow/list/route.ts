import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get('cvId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {};
    if (cvId) {
      where.cvId = cvId;
    }
    if (status) {
      where.status = status;
    }

    const [executions, total] = await Promise.all([
      prisma.workflowExecution.findMany({
        where,
        include: {
          cv: {
            select: {
              id: true,
              originalName: true,
              consultantName: true,
            },
          },
          _count: {
            select: { steps: true },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.workflowExecution.count({ where }),
    ]);

    const executionsWithSummary = await Promise.all(
      executions.map(async (execution) => {
        const stepCounts = await prisma.workflowStep.groupBy({
          by: ['status'],
          where: { executionId: execution.id },
          _count: true,
        });

        const summary = {
          total: execution._count.steps,
          pending: 0,
          waitingInputs: 0,
          running: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
        };

        for (const count of stepCounts) {
          const key = count.status.toLowerCase().replace('_', '');
          if (key === 'waitinginputs') {
            summary.waitingInputs = count._count;
          } else if (key in summary) {
            (summary as Record<string, number>)[key] = count._count;
          }
        }

        return {
          id: execution.id,
          cvId: execution.cvId,
          cv: execution.cv,
          status: execution.status,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          error: execution.error,
          summary,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        executions: executionsWithSummary,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('Error listing executions:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des exécutions' },
      { status: 500 }
    );
  }
}
