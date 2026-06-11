#!/bin/sh
set -e

echo "Running database migrations..."
node_modules/.bin/prisma migrate deploy

echo "Starting Next.js server..."
exec node_modules/.bin/next start
