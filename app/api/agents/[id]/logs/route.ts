import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { apiRoute, error } from '@/lib/api-route';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  cvId: z.string().optional(),
  success: z.enum(['true', 'false']).optional(),
});

export const GET = apiRoute()
  .params(z.object({ id: z.string() }))
  .handler(async (request, { params }) => {
    const { id: agentId } = params;

    // Vérifier que l'agent existe
    const agent = await prisma.aIAgent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, displayName: true },
    });

    if (!agent) {
      return error('Agent not found', 404);
    }

    // Parser les query params
    const url = new URL(request.url);
    const queryResult = querySchema.safeParse({
      limit: url.searchParams.get('limit') ?? 20,
      offset: url.searchParams.get('offset') ?? 0,
      cvId: url.searchParams.get('cvId') ?? undefined,
      success: url.searchParams.get('success') ?? undefined,
    });

    if (!queryResult.success) {
      return error('Invalid query parameters', 400);
    }

    const { limit, offset, cvId, success } = queryResult.data;

    // Construire le filtre
    const where: {
      agentId: string;
      cvId?: string;
      success?: boolean;
    } = { agentId };

    if (cvId) {
      where.cvId = cvId;
    }

    if (success !== undefined) {
      where.success = success === 'true';
    }

    // Récupérer les logs avec pagination
    const [logs, total] = await Promise.all([
      prisma.agentExecutionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          cvId: true,
          executionId: true,
          stepId: true,
          systemPrompt: true,
          userPrompt: true,
          inputMarkdown: true,
          pastMissionNotes: true,
          futureMissionNotes: true,
          outputMarkdown: true,
          durationMs: true,
          tokensInput: true,
          tokensOutput: true,
          success: true,
          error: true,
          createdAt: true,
          cv: {
            select: {
              consultantName: true,
              originalName: true,
            },
          },
        },
      }),
      prisma.agentExecutionLog.count({ where }),
    ]);

    // Calculer les statistiques
    const stats = await prisma.agentExecutionLog.aggregate({
      where: { agentId },
      _count: { id: true },
      _avg: { durationMs: true },
      _min: { durationMs: true },
      _max: { durationMs: true },
    });

    const successCount = await prisma.agentExecutionLog.count({
      where: { agentId, success: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          name: agent.name,
          displayName: agent.displayName,
        },
        logs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        stats: {
          totalExecutions: stats._count.id,
          successRate: stats._count.id > 0 ? (successCount / stats._count.id) * 100 : 0,
          avgDurationMs: Math.round(stats._avg.durationMs || 0),
          minDurationMs: stats._min.durationMs || 0,
          maxDurationMs: stats._max.durationMs || 0,
        },
      },
    });
  });
