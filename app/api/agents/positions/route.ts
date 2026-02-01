import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';

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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { positions } = positionUpdateSchema.parse(body);

    await prisma.$transaction(
      positions.map(({ agentId, x, y }) =>
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        { success: false, error: 'One or more agents not found' },
        { status: 404 }
      );
    }

    console.error('Error updating agent positions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update positions' },
      { status: 500 }
    );
  }
}
