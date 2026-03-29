# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — Strength Log (Next.js standalone + Prisma/SQLite)
#
# Multi-stage build:
#   1. deps    — install all npm dependencies
#   2. builder — generate Prisma client + next build (standalone)
#   3. runner  — lean production image (~180 MB on M1)
#
# The database lives in a Docker volume mounted at /app/prisma/dev.db,
# matching the path that process.cwd() + '/prisma/dev.db' resolves to
# in the API route backup logic.
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20-alpine

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Add libc compat for native modules on Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci


# ── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate the Prisma client for the target platform
RUN npx prisma generate

# Build the Next.js standalone bundle
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# ── Stage 3: Lean production runner ──────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for safety
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# ── Next.js standalone server ────────────────────────────────────────────────
COPY --from=builder /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# ── Prisma: client binary + schema + migrations ──────────────────────────────
# The generated client is already bundled inside standalone/node_modules,
# but we also need the query engine binary and the CLI for migrate/seed.
COPY --from=builder /app/node_modules/.prisma          ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma          ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma           ./node_modules/prisma

# Seed script dependencies — install tsx globally (avoids symlink copy issues)
RUN npm install -g tsx

# Stage migration files and schema separately from the volume mount path,
# so the entrypoint can copy them in on every start (handles new migrations).
COPY --from=builder /app/prisma/migrations /app/prisma_migrations_staging
COPY --from=builder /app/prisma/schema.prisma /app/prisma_schema/schema.prisma
COPY --from=builder /app/prisma/migrations/migration_lock.toml /app/prisma_schema/migration_lock.toml
COPY --from=builder /app/prisma/seed.ts /app/prisma/seed.ts

# The src/lib files needed by seed.ts
COPY --from=builder /app/src/lib/prisma.ts /app/src/lib/prisma.ts
COPY --from=builder /app/src/lib/utils.ts  /app/src/lib/utils.ts

# tsconfig for tsx to transpile seed.ts
COPY --from=builder /app/tsconfig.json /app/tsconfig.json

# Entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# /app/prisma is the volume mount point — nextjs user needs write access
RUN mkdir -p /app/prisma && chown -R nextjs:nodejs /app/prisma

# /app/backups for safe exports to the host machine
RUN mkdir -p /app/backups && chown -R nextjs:nodejs /app/backups

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# DATABASE_URL points into /app/prisma (the volume mount)
ENV DATABASE_URL="file:./dev.db"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
