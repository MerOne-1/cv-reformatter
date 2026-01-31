import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { listRawCVs, getRawCVKey } from '@/lib/b2';
import { CVListItem } from '@/lib/types';

export async function GET() {
  try {
    // Get files from B2
    const b2Files = await listRawCVs();

    // Get existing CVs from database
    const existingCVs = await prisma.cV.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Create a map of existing CVs by originalKey
    const cvMap = new Map(existingCVs.map(cv => [cv.originalKey, cv]));

    // Merge B2 files with DB records
    const cvList: CVListItem[] = [];

    // First, add CVs that exist in both B2 and DB
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
        });
      } else {
        // File exists in B2 but not in DB - create a pending entry
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
        });
      }
    }

    // Sort by createdAt desc
    cvList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      data: cvList,
    });
  } catch (error) {
    console.error('Error listing CVs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list CVs',
      },
      { status: 500 }
    );
  }
}
