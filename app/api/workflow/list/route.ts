import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { apiRoute } from '@/lib/api-route';

const querySchema = z.object({
  cvId: z.string().optional(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const GET = apiRoute()
  .query(querySchema)
  .handler(async (_, { query }) => {
    const where: Record<string, unknown> = {};
    if (query.cvId) {
      where.cvId = query.cvId;
    }
    if (query.status) {
      where.status = query.status;
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
        take: query.limit,
        skip: query.offset,
      }),
      prisma.workflowExecution.count({ where }),
    ]);

    // Fix N+1: Get all step counts in a single query
    const executionIds = executions.map(e => e.id);
    const allStepCounts = executionIds.length > 0
      ? await prisma.workflowStep.groupBy({
          by: ['executionId', 'status'],
          where: { executionId: { in: executionIds } },
          _count: true,
        })
      : [];

    // Build a map of execution ID -> status counts
    const stepCountsByExecution = new Map<string, Map<string, number>>();
    for (const count of allStepCounts) {
      if (!stepCountsByExecution.has(count.executionId)) {
        stepCountsByExecution.set(count.executionId, new Map());
      }
      stepCountsByExecution.get(count.executionId)!.set(count.status, count._count);
    }

    const executionsWithSummary = executions.map((execution) => {
      const statusCounts = stepCountsByExecution.get(execution.id) || new Map();

      const summary = {
        total: execution._count.steps,
        pending: statusCounts.get('PENDING') || 0,
        waitingInputs: statusCounts.get('WAITING_INPUTS') || 0,
        running: statusCounts.get('RUNNING') || 0,
        completed: statusCounts.get('COMPLETED') || 0,
        failed: statusCounts.get('FAILED') || 0,
        skipped: statusCounts.get('SKIPPED') || 0,
      };

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
    });

    return NextResponse.json({
      success: true,
      data: {
        executions: executionsWithSummary,
        pagination: {
          total,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + query.limit < total,
        },
      },
    });
  });
