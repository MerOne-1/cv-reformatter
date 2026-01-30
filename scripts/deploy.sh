#!/bin/bash
set -e

# =============================================================================
# CV-Reformatter Deploy Script
# =============================================================================
# Usage: ./scripts/deploy.sh
# =============================================================================

SERVER="root@46.224.42.156"
APP_DIR="/opt/cv-reformatter"
REPO_URL="https://github.com/MerOne-1/cv-reformatter.git"

echo "🚀 Deploying CV-Reformatter to Hetzner..."

# 1. Connect to server and setup
ssh $SERVER << 'ENDSSH'
set -e

APP_DIR="/opt/cv-reformatter"
REPO_URL="https://github.com/MerOne-1/cv-reformatter.git"

echo "📁 Setting up directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or pull repo
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes..."
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone $REPO_URL .
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating from template..."
    cp .env.production.example .env
    echo ""
    echo "❌ IMPORTANT: You need to edit .env with your actual values!"
    echo "   Run: nano /opt/cv-reformatter/.env"
    echo ""
    exit 1
fi

echo "🐳 Building and starting containers..."
docker compose down --remove-orphans || true
docker compose build --no-cache
docker compose up -d

echo "⏳ Waiting for database to be ready..."
sleep 10

echo "🗃️  Running database migrations..."
docker compose exec -T app npx prisma migrate deploy || {
    echo "⚠️  Migration failed, trying to push schema..."
    docker compose exec -T app npx prisma db push
}

echo "🌱 Seeding templates..."
docker compose exec -T app npx tsx scripts/seed-templates.ts || echo "⚠️  Seeding skipped or failed"

echo ""
echo "✅ Deployment complete!"
echo ""
docker compose ps
echo ""
echo "🌐 App available at: http://46.224.42.156:3000"

ENDSSH

echo "🎉 Done!"
