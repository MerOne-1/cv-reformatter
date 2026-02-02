import prisma from '@/lib/db';
import { z } from 'zod';
import { apiRoute, success, error } from '@/lib/api-route';

const paramsSchema = z.object({ id: z.string() });

const updateConnectionSchema = z.object({
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const GET = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    const connection = await prisma.agentConnection.findUnique({
      where: { id: params.id },
      include: {
        sourceAgent: {
          select: { id: true, name: true, displayName: true, isActive: true },
        },
        targetAgent: {
          select: { id: true, name: true, displayName: true, isActive: true },
        },
      },
    });

    if (!connection) {
      return error('Connexion introuvable', 404);
    }

    return success(connection);
  });

export const PATCH = apiRoute()
  .params(paramsSchema)
  .body(updateConnectionSchema)
  .handler(async (_, { params, body }) => {
    const existing = await prisma.agentConnection.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return error('Connexion introuvable', 404);
    }

    const connection = await prisma.agentConnection.update({
      where: { id: params.id },
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

    return success(connection);
  });

export const DELETE = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    const existing = await prisma.agentConnection.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return error('Connexion introuvable', 404);
    }

    await prisma.agentConnection.delete({
      where: { id: params.id },
    });

    return success({ deleted: true });
  });
