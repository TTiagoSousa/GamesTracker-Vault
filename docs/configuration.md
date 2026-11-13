# Configuration

The server reads its settings from environment variables:

- **Docker:** `.env` next to `docker-compose.yml`. The compose file turns it into the
  container's variables (for example `DB_PASSWORD` becomes part of `DATABASE_URL`).
  Apply changes with `docker compose up -d`.
- **Proxmox / Debian:** `/etc/gametracker/gametracker.env`. Edit it with
  `gametracker-config` (a menu that restarts the server when something changed).
- **Development:** `apps/backend/.env` (template: `apps/backend/.env.example`).

Everything else (the IGDB keys, assistant keys, backup schedule, users) is set in the app
and stored in the database.

## Server variables

| Variable | Required | Default | What it does |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection, `postgresql://user:password@host:5432/database`. |
| `JWT_SECRET` | yes | — | Signs the login sessions. Any long random string; changing it logs everyone out. |
| `TOKEN_ENCRYPTION_KEY` | yes | — | Base64 of 32 bytes. Encrypts the IGDB secret and the assistant keys in the database. **Never change it** after the first start: the stored keys would have to be entered again. |
| `FRONTEND_URL` | no | — | The address people open (the origin allowed by CORS). Only matters when the web app is served from another origin, as in development. |
| `PORT` | no | `3000` | Port the server listens on. |
| `HOST` | no | `0.0.0.0` | Interface it listens on. The Proxmox install uses `127.0.0.1` (only nginx talks to it). |
| `TZ` | no | the system's | Time zone of dates and of the backup schedule, e.g. `Europe/Lisbon`. |
| `TRUST_PROXY` | no | `loopback` (Docker: `loopback, uniquelocal`) | Which proxies may report the browser's protocol (`X-Forwarded-Proto`). That decides whether the session cookie is `secure`. `true`, `false`, a hop count or a list of addresses and names (`loopback`, `linklocal`, `uniquelocal`, CIDRs). |
| `BACKUP_DIR` | no | Docker `/data/backups`, Proxmox `/var/backups/gametracker` | Default folder for backups; Admin → Backups can choose another. |
| `PG_DUMP_PATH` | no | `pg_dump` on the PATH | The `pg_dump` used for backups. Its major version must be the database's or newer. |
| `WEB_DIR` | no | Docker `/app/web` | When set, the server also serves the built web app and moves the API under `/api`. |
| `NODE_ENV` | no | `production` in installs | `development` locally. |

Set by the installs, not by hand:

| Variable | Set by | What it does |
|---|---|---|
| `APP_VERSION`, `APP_COMMIT`, `APP_BUILD_DATE` | Docker image build | The version shown in Admin. With it, releases are read from GitHub instead of git. |
| `RELEASES_REPO` | — (default `TTiagoSousa/GamesTracker-Vault`) | The GitHub repository a Docker install compares its version with. |
| `APP_DIR` | Proxmox systemd unit | The git checkout the version is read from. |
| `SYSTEM_UPDATES_DIR` | Proxmox systemd unit | Enables in-app updates (the folder the updater watches). |

## Docker-only variables (`.env`)

| Variable | Default | What it does |
|---|---|---|
| `DB_PASSWORD` | — | Password of the PostgreSQL user. Letters and digits only (it goes inside a URL). |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / — | First account, created only while the database has no users. |
| `APP_URL` | `http://localhost:8080` | Passed as `FRONTEND_URL`. |
| `PORT` | `8080` | Port on the host. |
| `VERSION` | `latest` | Image tag to run, e.g. `1.0.0` or `1.0`. |

## Proxmox-only settings

`gametracker-config` offers the app address (`FRONTEND_URL`). The database URL and the
two secrets are left out on purpose; `gametracker-config --raw` opens the whole file in
an editor, for anything else.

The credentials generated at install time are in `/root/gametracker-credentials.txt`
inside the container. Keep a copy of it somewhere else: it holds
`TOKEN_ENCRYPTION_KEY`.

## In the app

| Where | What |
|---|---|
| Admin → Game catalogue (IGDB) | Twitch Client ID and Client Secret, needed for search. |
| Admin → Users | Accounts and roles. Registration is closed after the first account. |
| Admin → Backups | Schedule, how many days to keep, folder, backup now, download. |
| Settings → Assistant | Each user's own Anthropic key and model (optional). |
| Settings → API tokens | Personal tokens for the [API](./API.md). |
