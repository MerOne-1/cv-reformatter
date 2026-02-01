#!/bin/sh
set -e

echo "=== Starting CV Reformatter ==="

# Run Prisma schema sync (push changes without generating client)
echo "Running Prisma schema sync..."
npx prisma@6 db push --skip-generate --accept-data-loss 2>/dev/null || {
  echo "Warning: Prisma db push failed, continuing anyway..."
}

# Run seed if SEED_DATABASE is set
if [ "$SEED_DATABASE" = "true" ] || [ "$SEED_DATABASE" = "1" ]; then
  echo "Running database seed..."
  node prisma/seed.js || {
    echo "Warning: Database seed failed, continuing anyway..."
  }
fi

echo "Starting application..."
exec node server.js
