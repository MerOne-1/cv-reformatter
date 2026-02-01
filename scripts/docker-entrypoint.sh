#!/bin/sh
set -e

echo "=== Starting CV Reformatter ==="

# Apply Prisma schema (temporary - remove after first deploy)
echo "Applying Prisma schema..."
npx prisma db push --skip-generate --accept-data-loss || echo "Prisma push failed, continuing..."

exec node server.js
