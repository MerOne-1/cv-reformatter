import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import { z } from 'zod';

const createCommentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  cvId: z.string().min(1, 'CV ID is required'),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
}).refine((data) => data.endOffset >= data.startOffset, {
  message: 'endOffset must be greater than or equal to startOffset',
  path: ['endOffset'],
});

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get('cvId');

    if (!cvId) {
      return NextResponse.json(
        { success: false, error: 'cvId query parameter is required' },
        { status: 400 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: { cvId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            highlightColor: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch comments',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createCommentSchema.parse(body);

    const comment = await prisma.comment.create({
      data: {
        content: validatedData.content,
        cvId: validatedData.cvId,
        userId: currentUser.id,
        startOffset: validatedData.startOffset,
        endOffset: validatedData.endOffset,
      },
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

    console.error('Error creating comment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create comment',
      },
      { status: 500 }
    );
  }
}
