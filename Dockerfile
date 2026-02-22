# ─── Stage 1: Install & Build ───────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install all deps (both api + web)
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY apps/api/ apps/api/
COPY apps/web/ apps/web/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API (TypeScript → dist/)
RUN cd apps/api && pnpm build

# Build Web (Vite → dist/)
RUN cd apps/web && pnpm build

# ─── Stage 2: Production ────────────────────────────────
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod || pnpm install --prod

# Copy Prisma schema + migrations (needed for migrate deploy)
COPY apps/api/prisma/ apps/api/prisma/

# Re-generate Prisma client in production image
RUN cd apps/api && npx prisma generate

# Copy API build output
COPY --from=builder /app/apps/api/dist/ apps/api/dist/

# Copy Web build output → served as static files
COPY --from=builder /app/apps/web/dist/ apps/web/dist/

# Expose port
EXPOSE 3000

# Run migrations then start API server
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && node dist/server.js"]
