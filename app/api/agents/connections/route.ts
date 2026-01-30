import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export async function GET() {
  try {
    const connections = await prisma.agentConnection.findMany({
      include: {
        sourceAgent: {
          select: { id: true, name: true, displayName: true, isActive: true },
        },
        targetAgent: {
          select: { id: true, name: true, displayName: true, isActive: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: connections,
    });
  } catch (error) {
    console.error('Error fetching connections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

const createConnectionSchema = z.object({
  sourceAgentId: z.string().min(1),
  targetAgentId: z.string().min(1),
  order: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createConnectionSchema.parse(body);

    if (data.sourceAgentId === data.targetAgentId) {
      return NextResponse.json(
        { success: false, error: 'Un agent ne peut pas se connecter à lui-même' },
        { status: 400 }
      );
    }

    const [sourceAgent, targetAgent] = await Promise.all([
      prisma.aIAgent.findUnique({ where: { id: data.sourceAgentId } }),
      prisma.aIAgent.findUnique({ where: { id: data.targetAgentId } }),
    ]);

    if (!sourceAgent || !targetAgent) {
      return NextResponse.json(
        { success: false, error: 'Agent source ou cible introuvable' },
        { status: 404 }
      );
    }

    const wouldCreateCycle = await detectCycle(data.sourceAgentId, data.targetAgentId);
    if (wouldCreateCycle) {
      return NextResponse.json(
        { success: false, error: 'Cette connexion créerait un cycle dans le graphe' },
        { status: 400 }
      );
    }

    const connection = await prisma.agentConnection.create({
      data,
      include: {
        sourceAgent: {
          select: { id: true, name: true, displayName: true, isActive: true },
        },
        targetAgent: {
          select: { id: true, name: true, displayName: true, isActive: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: connection,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Cette connexion existe déjà' },
        { status: 409 }
      );
    }
    console.error('Error creating connection:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create connection' },
      { status: 500 }
    );
  }
}

async function detectCycle(sourceId: string, targetId: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [targetId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === sourceId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const outgoingConnections = await prisma.agentConnection.findMany({
      where: { sourceAgentId: current, isActive: true },
      select: { targetAgentId: true },
    });

    for (const conn of outgoingConnections) {
      queue.push(conn.targetAgentId);
    }
  }

  return false;
}
