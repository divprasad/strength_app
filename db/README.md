# This directory is bind-mounted as /app/prisma inside the Docker container.
# Contents are git-ignored. See .gitignore.
#
# db/strength_diary.db  — live production database
# db/backups/           — rolling numbered backups
# db/migrations/        — synced by docker-entrypoint.sh on each boot
# db/schema.prisma      — synced by docker-entrypoint.sh on each boot
