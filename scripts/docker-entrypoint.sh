#!/bin/sh
set -e

echo "=== Starting CV Reformatter ==="

# Run Prisma migrations (safe for production - only applies pending migrations)
echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec node server.js
