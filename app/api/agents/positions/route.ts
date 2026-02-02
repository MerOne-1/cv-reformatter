import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { apiRoute, error } from '@/lib/api-route';

const positionUpdateSchema = z.object({
  positions: z
    .array(
      z.object({
        agentId: z.string(),
        x: z.number().finite(),
        y: z.number().finite(),
      })
    )
    .min(1)
    .max(100),
});

export const PATCH = apiRoute()
  .body(positionUpdateSchema)
  .handler(async (_, { body }) => {
    try {
      await prisma.$transaction(
        body.positions.map(({ agentId, x, y }) =>
          prisma.aIAgent.update({
            where: { id: agentId },
            data: {
              positionX: x,
              positionY: y,
            },
          })
        )
      );

      return NextResponse.json({ success: true });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        return error('One or more agents not found', 404);
      }
      throw e;
    }
  });
