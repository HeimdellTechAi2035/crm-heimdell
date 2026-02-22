#!/usr/bin/env bash
set -e

echo "==> Installing dependencies..."
corepack enable
corepack prepare pnpm@9 --activate
pnpm install

echo "==> Generating Prisma client..."
cd apps/api
npx prisma generate

echo "==> Building API..."
pnpm build
cd ../..

echo "==> Building Web..."
cd apps/web
pnpm build
cd ../..

echo "==> Build complete!"
