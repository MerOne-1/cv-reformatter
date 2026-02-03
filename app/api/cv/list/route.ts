import prisma from '@/lib/db';
import { listRawCVs, getRawCVKey } from '@/lib/b2';
import { CVListItem } from '@/lib/types';
import { apiRoute, success } from '@/lib/api-route';

export const GET = apiRoute().handler(async () => {
  const b2Files = await listRawCVs();

  const existingCVs = await prisma.cV.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const activeWorkflows = await prisma.workflowExecution.groupBy({
    by: ['cvId'],
    where: { status: { in: ['PENDING', 'RUNNING'] } },
  });
  const activeWorkflowCvIds = new Set(activeWorkflows.map((w) => w.cvId));

  const cvMap = new Map(existingCVs.map((cv) => [cv.originalKey, cv]));

  const cvList: CVListItem[] = [];

  for (const file of b2Files) {
    const key = getRawCVKey(file.name);
    const existingCV = cvMap.get(key);

    if (existingCV) {
      cvList.push({
        id: existingCV.id,
        originalName: existingCV.originalName,
        consultantName: existingCV.consultantName,
        title: existingCV.title,
        status: existingCV.status,
        templateName: existingCV.templateName,
        createdAt: existingCV.createdAt,
        updatedAt: existingCV.updatedAt,
        hasMissingFields: existingCV.missingFields.length > 0,
        hasActiveWorkflow: activeWorkflowCvIds.has(existingCV.id),
      });
    } else {
      const newCV = await prisma.cV.create({
        data: {
          originalName: file.name,
          originalKey: key,
          status: 'PENDING',
        },
      });

      cvList.push({
        id: newCV.id,
        originalName: newCV.originalName,
        consultantName: null,
        title: null,
        status: newCV.status,
        templateName: newCV.templateName,
        createdAt: newCV.createdAt,
        updatedAt: newCV.updatedAt,
        hasMissingFields: false,
        hasActiveWorkflow: false,
      });
    }
  }

  cvList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return success(cvList);
});
