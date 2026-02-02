import { createZodRoute } from 'next-zod-route';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { randomUUID } from 'crypto';

export function apiRoute() {
  return createZodRoute({
    handleServerError: (err) => {
      const errorId = randomUUID().slice(0, 8);
      console.error(`API Error [${errorId}]:`, err);

      if (err instanceof ZodError) {
        return NextResponse.json(
          { success: false, error: 'Validation error', details: err.errors, errorId },
          { status: 400 }
        );
      }

      // Don't expose internal error details to clients
      return NextResponse.json(
        { success: false, error: 'Internal server error', errorId },
        { status: 500 }
      );
    },
  });
}

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}
