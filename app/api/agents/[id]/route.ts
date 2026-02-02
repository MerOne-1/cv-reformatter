import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { apiRoute, success, error } from '@/lib/api-route';

const paramsSchema = z.object({ id: z.string() });

const updateAgentSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().min(1).optional(),
  systemPrompt: z.string().min(1).optional(),
  userPromptTemplate: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().optional(),
});

export const GET = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    const agent = await prisma.aIAgent.findUnique({
      where: { id: params.id },
    });

    if (!agent) {
      return error('Agent not found', 404);
    }

    return success(agent);
  });

export const PATCH = apiRoute()
  .params(paramsSchema)
  .body(updateAgentSchema)
  .handler(async (_, { params, body }) => {
    try {
      const agent = await prisma.aIAgent.update({
        where: { id: params.id },
        data: body,
      });

      return success(agent);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return error('Agent not found', 404);
      }
      throw e;
    }
  });

export const DELETE = apiRoute()
  .params(paramsSchema)
  .handler(async (_, { params }) => {
    try {
      await prisma.aIAgent.delete({
        where: { id: params.id },
      });

      return success({ deleted: true });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return error('Agent not found', 404);
      }
      throw e;
    }
  });
