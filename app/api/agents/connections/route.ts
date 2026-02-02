import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { apiRoute, success, error } from '@/lib/api-route';

const createConnectionSchema = z.object({
  sourceAgentId: z.string().min(1),
  targetAgentId: z.string().min(1),
  order: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const GET = apiRoute().handler(async () => {
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

  return success(connections);
});

export const POST = apiRoute()
  .body(createConnectionSchema)
  .handler(async (_, { body }) => {
    if (body.sourceAgentId === body.targetAgentId) {
      return error('Un agent ne peut pas se connecter à lui-même', 400);
    }

    // Use transaction to ensure atomicity between cycle detection and creation
    try {
      const connection = await prisma.$transaction(async (tx) => {
        const [sourceAgent, targetAgent] = await Promise.all([
          tx.aIAgent.findUnique({ where: { id: body.sourceAgentId } }),
          tx.aIAgent.findUnique({ where: { id: body.targetAgentId } }),
        ]);

        if (!sourceAgent || !targetAgent) {
          throw new Error('AGENT_NOT_FOUND');
        }

        // Check for cycles within the transaction
        const wouldCreateCycle = await detectCycleInTransaction(tx, body.sourceAgentId, body.targetAgentId);
        if (wouldCreateCycle) {
          throw new Error('CYCLE_DETECTED');
        }

        return tx.agentConnection.create({
          data: body,
          include: {
            sourceAgent: {
              select: { id: true, name: true, displayName: true, isActive: true },
            },
            targetAgent: {
              select: { id: true, name: true, displayName: true, isActive: true },
            },
          },
        });
      });

      return success(connection);
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'AGENT_NOT_FOUND') {
          return error('Agent source ou cible introuvable', 404);
        }
        if (e.message === 'CYCLE_DETECTED') {
          return error('Cette connexion créerait un cycle dans le graphe', 400);
        }
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return error('Cette connexion existe déjà', 409);
      }
      throw e;
    }
  });

type TransactionClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

async function detectCycleInTransaction(tx: TransactionClient, sourceId: string, targetId: string): Promise<boolean> {
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

    const outgoingConnections = await tx.agentConnection.findMany({
      where: { sourceAgentId: current, isActive: true },
      select: { targetAgentId: true },
    });

    for (const conn of outgoingConnections) {
      queue.push(conn.targetAgentId);
    }
  }

  return false;
}
