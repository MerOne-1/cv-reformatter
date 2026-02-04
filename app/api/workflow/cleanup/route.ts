import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { apiRoute } from '@/lib/api-route';

/**
 * POST /api/workflow/cleanup
 * Nettoie les workflows bloqués (PENDING ou RUNNING depuis plus de 30 minutes)
 */
export const POST = apiRoute().handler(async () => {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  // Marquer comme FAILED tous les workflows bloqués
  const result = await prisma.workflowExecution.updateMany({
    where: {
      status: { in: ['PENDING', 'RUNNING'] },
      startedAt: { lt: thirtyMinutesAgo },
    },
    data: {
      status: 'FAILED',
      error: 'Workflow automatiquement marqué comme échoué (timeout)',
      completedAt: new Date(),
    },
  });

  // Aussi nettoyer les steps orphelins
  await prisma.workflowStep.updateMany({
    where: {
      status: { in: ['PENDING', 'RUNNING'] },
      startedAt: { lt: thirtyMinutesAgo },
    },
    data: {
      status: 'FAILED',
      error: 'Step automatiquement marqué comme échoué (timeout)',
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      cleanedWorkflows: result.count,
      message: `${result.count} workflow(s) bloqué(s) nettoyé(s)`,
    },
  });
});
