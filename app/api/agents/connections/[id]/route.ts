import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';

type RouteParams = Promise<{ id: string }>;

export async function GET(
  _request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;

    const connection = await prisma.agentConnection.findUnique({
      where: { id },
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
      return NextResponse.json(
        { success: false, error: 'Connexion introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: connection,
    });
  } catch (error) {
    console.error('Error fetching connection:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connection' },
      { status: 500 }
    );
  }
}

const updateConnectionSchema = z.object({
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateConnectionSchema.parse(body);

    const existing = await prisma.agentConnection.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Connexion introuvable' },
        { status: 404 }
      );
    }

    const connection = await prisma.agentConnection.update({
      where: { id },
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
    console.error('Error updating connection:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update connection' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;

    const existing = await prisma.agentConnection.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Connexion introuvable' },
        { status: 404 }
      );
    }

    await prisma.agentConnection.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete connection' },
      { status: 500 }
    );
  }
}
