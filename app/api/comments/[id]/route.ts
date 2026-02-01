import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import { z } from 'zod';

const updateCommentSchema = z.object({
  content: z.string().min(1).optional(),
  resolved: z.boolean().optional(),
  resolvedBy: z.string().optional(),
}).refine((data) => {
  if (data.resolved === true && !data.resolvedBy) {
    return false;
  }
  return true;
}, { message: 'resolvedBy is required when resolving a comment', path: ['resolvedBy'] });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthenticatedUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            highlightColor: true,
          },
        },
      },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error fetching comment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch comment',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthenticatedUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const existingComment = await prisma.comment.findUnique({ where: { id } });
    if (!existingComment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (existingComment.userId !== currentUser.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - you can only edit your own comments' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateCommentSchema.parse(body);

    const updateData: Record<string, unknown> = {
      ...validatedData,
      updatedAt: new Date(),
    };

    if (validatedData.resolved === true) {
      updateData.resolvedAt = new Date();
    } else if (validatedData.resolved === false) {
      updateData.resolvedAt = null;
      updateData.resolvedBy = null;
    }

    const comment = await prisma.comment.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            highlightColor: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating comment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update comment',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthenticatedUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const existingComment = await prisma.comment.findUnique({ where: { id } });
    if (!existingComment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (existingComment.userId !== currentUser.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - you can only delete your own comments' },
        { status: 403 }
      );
    }

    await prisma.comment.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete comment',
      },
      { status: 500 }
    );
  }
}
