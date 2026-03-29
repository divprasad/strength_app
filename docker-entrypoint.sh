#!/bin/sh
set -e

# ─────────────────────────────────────────────────────────────────────────────
# docker-entrypoint.sh
#
# Runs inside the final (runner) stage before `node server.js`.
#
# Responsibilities:
#   1. Copy fresh migration files from the image's staging area into the
#      volume-mounted /app/prisma/ so new migrations survive container rebuilds.
#   2. Run `prisma migrate deploy` — creates dev.db if missing, applies any
#      pending migrations against an existing one.
#   3. If dev.db was just created (first boot), run `prisma db seed` to
#      populate default muscle groups and exercises.
#   4. Start the Next.js standalone server.
# ─────────────────────────────────────────────────────────────────────────────

PRISMA_VOLUME="/app/prisma"
MIGRATIONS_STAGING="/app/prisma_migrations_staging"
DB_PATH="${PRISMA_VOLUME}/dev.db"

echo "[entrypoint] Syncing fresh migration files into volume..."
# Ensure the migrations directory exists in the volume
mkdir -p "${PRISMA_VOLUME}/migrations"

# Copy any new migration folders from the staging area baked into the image.
# rsync-style: only adds/updates, never deletes existing migration history.
if [ -d "${MIGRATIONS_STAGING}" ]; then
  cp -rn "${MIGRATIONS_STAGING}/." "${PRISMA_VOLUME}/migrations/" 2>/dev/null || true
fi

# Always ensure the schema and lock file are current in the volume
cp /app/prisma_schema/schema.prisma "${PRISMA_VOLUME}/schema.prisma"
cp /app/prisma_schema/migration_lock.toml "${PRISMA_VOLUME}/migrations/migration_lock.toml"

# ── Detect fresh database ────────────────────────────────────────────────────
FRESH_DB=false
if [ ! -f "${DB_PATH}" ]; then
  FRESH_DB=true
  echo "[entrypoint] No existing dev.db found — fresh install."
fi

# ── Apply migrations ─────────────────────────────────────────────────────────
echo "[entrypoint] Running prisma migrate deploy..."
cd /app
/app/node_modules/.bin/prisma migrate deploy --schema="${PRISMA_VOLUME}/schema.prisma"

# ── Seed on fresh install only ───────────────────────────────────────────────
if [ "$FRESH_DB" = "true" ]; then
  echo "[entrypoint] Fresh database detected — seeding default data..."
  /app/node_modules/.bin/prisma db seed
else
  echo "[entrypoint] Existing database found — skipping seed."
fi

echo "[entrypoint] Starting Next.js server..."
exec node server.js
