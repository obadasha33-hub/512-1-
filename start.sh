#!/bin/sh
set -e

echo "[Startup] NODE_ENV=$NODE_ENV"
echo "[Startup] DATABASE_URL=$DATABASE_URL"

echo "[Startup] Pushing Prisma schema to database..."
npx prisma db push --skip-generate --accept-data-loss 2>&1
echo "[Startup] Prisma schema pushed successfully."

echo "[Startup] Starting server..."
exec node server.js
