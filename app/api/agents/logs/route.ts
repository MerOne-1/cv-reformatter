import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';
import { apiRoute } from '@/lib/api-route';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  agentId: z.string().optional(),
  cvId: z.string().optional(),
  success: z.enum(['true', 'false']).optional(),
});

export const GET = apiRoute()
  .handler(async (request) => {
    const url = new URL(request.url);
    const queryResult = querySchema.safeParse({
      limit: url.searchParams.get('limit') ?? 20,
      offset: url.searchParams.get('offset') ?? 0,
      agentId: url.searchParams.get('agentId') ?? undefined,
      cvId: url.searchParams.get('cvId') ?? undefined,
      success: url.searchParams.get('success') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { limit, offset, agentId, cvId, success } = queryResult.data;

    // Construire le filtre
    const where: {
      agentId?: string;
      cvId?: string;
      success?: boolean;
    } = {};

    if (agentId) {
      where.agentId = agentId;
    }

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
          agentId: true,
          cvId: true,
          executionId: true,
          durationMs: true,
          success: true,
          error: true,
          createdAt: true,
          agent: {
            select: {
              name: true,
              displayName: true,
            },
          },
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

    // Statistiques par agent
    const statsByAgent = await prisma.agentExecutionLog.groupBy({
      by: ['agentId'],
      _count: { id: true },
      _avg: { durationMs: true },
    });

    // Récupérer les noms des agents pour les stats
    const agentIds = statsByAgent.map((s) => s.agentId);
    const agents = await prisma.aIAgent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, displayName: true },
    });

    const agentMap = new Map(agents.map((a) => [a.id, a]));

    const statsWithNames = statsByAgent.map((s) => ({
      agent: agentMap.get(s.agentId),
      totalExecutions: s._count.id,
      avgDurationMs: Math.round(s._avg.durationMs || 0),
    }));

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        statsByAgent: statsWithNames,
      },
    });
  });
