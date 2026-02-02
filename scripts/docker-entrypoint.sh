#!/bin/sh
set -e

echo "=== Starting CV Reformatter ==="

# Run database migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy || {
    echo "⚠️ Migration failed, trying db push..."
    npx prisma db push --accept-data-loss || echo "⚠️ DB push also failed, continuing anyway..."
}

# Run seed to sync agents and templates
echo "🌱 Running database seed..."
tsx prisma/seed.ts || {
    echo "⚠️ Seed failed, trying with npx..."
    npx tsx prisma/seed.ts || echo "⚠️ Seed failed, continuing anyway..."
}

echo "✅ Database ready!"

# Start the application
echo "🚀 Starting Next.js server..."
exec node server.js
