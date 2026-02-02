import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { apiRoute, success, error } from '@/lib/api-route';

const createAgentSchema = z.object({
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  description: z.string().min(1),
  systemPrompt: z.string().min(1),
  userPromptTemplate: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  order: z.number().int().optional().default(0),
});

export const GET = apiRoute().handler(async () => {
  const agents = await prisma.aIAgent.findMany({
    orderBy: { order: 'asc' },
  });

  return success(agents);
});

export const POST = apiRoute()
  .body(createAgentSchema)
  .handler(async (_, { body }) => {
    try {
      const agent = await prisma.aIAgent.create({
        data: body,
      });

      return success(agent);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return error('An agent with this name already exists', 409);
      }
      throw e;
    }
  });
