# syntax=docker/dockerfile:1
#
# GamesTracker Vault — one image with the server and the web app.
#
#   docker build -t gamestracker-vault .
#
# The server serves the web app itself (WEB_DIR) and the API under /api, so the
# container needs only PostgreSQL next to it (see deploy/docker/docker-compose.yml).
# It runs as the unprivileged "node" user; database migrations run on every start.

ARG NODE_VERSION=22

# --- build: dependencies, shared package, server and web app -------------------------
FROM node:${NODE_VERSION}-trixie-slim AS build
WORKDIR /app

# bcrypt falls back to compiling itself when no prebuilt binary fits the platform.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Manifests first, so the dependency layer is reused while only the code changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN npm ci --no-audit --no-fund

COPY packages/shared packages/shared
COPY apps/backend apps/backend
COPY apps/frontend apps/frontend

# prisma.config.ts reads DATABASE_URL even just to generate the client; nothing connects.
RUN npm run build:shared \
 && DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build -w @gametracker/backend \
 && VITE_API_URL=/api npm run build -w @gametracker/frontend \
 && npm prune --omit=dev --no-audit --no-fund

# --- runtime ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-trixie-slim

# postgresql-client: pg_dump for the backups (17, the same major as the database image).
# tzdata: the TZ variable sets the time zone of dates and backup schedules.
# tini: forwards signals, so "docker stop" shuts the server down cleanly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client tzdata tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/backend/package.json /app/apps/backend/prisma.config.ts apps/backend/
COPY --from=build /app/apps/backend/prisma apps/backend/prisma
COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY --from=build /app/apps/frontend/dist web
COPY deploy/proxmox/create-admin.cjs apps/backend/create-admin.cjs
COPY --chmod=755 deploy/docker/entrypoint.sh /usr/local/bin/gamestracker-entrypoint

RUN mkdir -p /data/backups && chown -R node:node /data

# Set by the release workflow: the version the app shows and compares with GitHub.
ARG APP_VERSION=dev
ARG APP_COMMIT=
ARG APP_BUILD_DATE=
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    WEB_DIR=/app/web \
    BACKUP_DIR=/data/backups \
    TRUST_PROXY="loopback, uniquelocal" \
    APP_VERSION=${APP_VERSION} \
    APP_COMMIT=${APP_COMMIT} \
    APP_BUILD_DATE=${APP_BUILD_DATE}

LABEL org.opencontainers.image.title="GamesTracker Vault" \
      org.opencontainers.image.description="Self-hosted game tracker: server, web app and Android client." \
      org.opencontainers.image.source="https://github.com/TTiagoSousa/GamesTracker-Vault" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version="${APP_VERSION}"

USER node
EXPOSE 3000
VOLUME ["/data/backups"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

ENTRYPOINT ["/usr/bin/tini", "--", "gamestracker-entrypoint"]
