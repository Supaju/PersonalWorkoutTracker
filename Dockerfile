# syntax=docker/dockerfile:1

# ---- Stage 1: Install all dependencies ----
# Uses node:20-slim (Debian-based) so Prisma downloads debian openssl binaries,
# matching the Debian 13 production server.
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Stage 2: Build the Next.js app ----
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client for the linux-debian target environment
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Stage 3: Production runner ----
FROM node:20-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --gid 1001 nodejs \
    && useradd --uid 1001 --gid 1001 --no-create-home nextjs

# Copy all node_modules from deps stage.
# We need the full set (including devDeps) because the `prisma` CLI is a
# devDependency but is required at container startup for `migrate deploy`.
COPY --from=deps /app/node_modules ./node_modules

# Overwrite the Prisma generated client with the one produced in the builder.
# The builder ran `prisma generate` so this binary is correct for linux-debian.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy the Next.js production build and public assets
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/public ./public

# Copy Prisma schema and migrations — required by `prisma migrate deploy`
COPY prisma ./prisma

# Copy app config files needed at runtime
COPY package.json next.config.ts ./

# Create the persistent data directory for SQLite and give nextjs user ownership
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

COPY --chown=nextjs:nodejs entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./entrypoint.sh"]
