#!/bin/sh
# Starts GamesTracker Vault inside the Docker image: checks the configuration, applies the
# database migrations, creates the first account when there is none, then runs the server.
set -eu

missing=""
for name in DATABASE_URL JWT_SECRET TOKEN_ENCRYPTION_KEY; do
  eval "value=\${$name:-}"
  [ -n "$value" ] || missing="$missing $name"
done
if [ -n "$missing" ]; then
  echo "GamesTracker Vault: missing configuration:$missing" >&2
  echo "Set them in the .env next to docker-compose.yml (see deploy/docker/.env.example)." >&2
  exit 1
fi

cd /app/apps/backend

echo "Applying database migrations…"
attempt=1
until /app/node_modules/.bin/prisma migrate deploy; do
  if [ "$attempt" -ge 10 ]; then
    echo "The database did not accept the migrations after $attempt attempts." >&2
    exit 1
  fi
  echo "Database not ready yet — retrying in 3 s ($attempt/10)…"
  attempt=$((attempt + 1))
  sleep 3
done

# First start only: the account is created when the database has no users yet.
if [ -n "${ADMIN_USERNAME:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  node create-admin.cjs
fi

exec node dist/src/main.js
