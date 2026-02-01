#!/bin/sh
set -e

echo "=== Starting CV Reformatter ==="

# Run Prisma schema sync (push changes without generating client)
echo "Running Prisma schema sync..."
npx prisma@6 db push --skip-generate --accept-data-loss 2>/dev/null || {
  echo "Warning: Prisma db push failed, continuing anyway..."
}

echo "Starting application..."
exec node server.js
