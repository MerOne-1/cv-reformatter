import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { apiRoute, error } from '@/lib/api-route';

export const GET = apiRoute().handler(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
      },
    });
  } catch (e) {
    // Log the actual error but don't expose details to clients
    console.error('Health check - database connection failed:', e);
    return error('Database connection failed', 503);
  }
});
