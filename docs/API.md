# GamesTracker Vault API

Everything the app does goes through this API, so other programs can do it too: read
your shelf, check the version, trigger an update, make and download backups. This page
is for people calling it from scripts and other tools (MyHomeLab, Home Assistant, cron
jobs…). The internals — guards, DTOs, how each route is built — are in
[06 · API — endpoints](./development/06-api-endpoints.md).

- [Getting started](#getting-started)
- [Authentication](#authentication)
- [Conventions](#conventions)
- [Health](#health)
- [Your account](#your-account)
- [Your shelf](#your-shelf)
- [Games (IGDB)](#games-igdb)
- [Assistant](#assistant)
- [Backups (admin)](#backups-admin)
- [Version and updates (admin)](#version-and-updates-admin)
- [Users (admin)](#users-admin)
- [IGDB credentials (admin)](#igdb-credentials-admin)
- [API tokens (browser only)](#api-tokens-browser-only)
- [Recipes](#recipes)
- [Errors](#errors)

## Getting started

**Base URL:** the address you open the app on, followed by `/api`:

```
https://gametracker.example.com/api
http://192.168.1.50/api
```

nginx forwards `/api/*` to the backend without the `/api` prefix, so the routes below
(`/library`, `/backups`…) are always written without it.

**A token:** in the app, **Settings → API → New token**. Give it a name, choose whether
it expires and whether it is read-only, and copy it — it is only shown once. Then:

```bash
export GTV=https://gametracker.example.com/api
export GTV_TOKEN=gtv_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

curl -H "Authorization: Bearer $GTV_TOKEN" "$GTV/auth/me"
```

```json
{ "id": "59b1aacb-…", "username": "tiago", "role": "ADMIN", "authMethod": "token", "isAdmin": true }
```

## Authentication

| | |
|---|---|
| Header | `Authorization: Bearer gtv_…` — only the header; a token in the URL is ignored |
| Who it acts as | the user who created it, with that user's **current** role: a token made by an admin can call the admin routes; demote the user and the token loses them on the next request |
| Read-only tokens | only `GET` requests; anything else is **403** "Este token só permite leitura." |
| Expiry | never, or 30, 90 or 365 days; an expired token is **401** "Token expirado" |
| Revoking | Settings → API → Revoke. Takes effect on the next request. Deleting the user revokes all their tokens |
| Storage | the server keeps only the token's SHA-256 and its first characters (`gtv_Ab12Cd`), to tell them apart in the list |
| Last used | shown in Settings → API (updated at most once a minute) |

Treat a token like a password: with an admin's full-access token someone can download
the whole database. Give each program its own token, read-only when it only reads, so
you can revoke one without touching the others.

The app itself signs in with a session cookie (`POST /auth/login`); every route below
accepts either the cookie or a token, except the token routes themselves.

## Conventions

- Requests and responses are JSON (`Content-Type: application/json`), except backup
  downloads (`application/gzip`) and the assistant's stream (`application/x-ndjson`).
- Dates are ISO 8601 (`2026-11-11T03:30:00.000Z`); calendar dates on the shelf are
  `YYYY-MM-DD`.
- Errors are `{ "statusCode": 400, "message": "…" }` (validation errors: `message` is a
  list). The messages are written in **Portuguese**, because the app shows them as they
  come; rely on the status code, not the text.
- Unknown fields in a body are dropped.

## Health

| Method | Route | Auth | Response |
|---|---|---|---|
| GET | `/health` | — | `{ "app": "gametracker-vault", "ok": true, "version": "v1.5.0" }` |

Public, for uptime monitors (Uptime Kuma, MyHomeLab…). `version` is the installed release
(the release it is based on when running a branch), or `null` without git information.

## Your account

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/auth/me` | — | `{ id, username, role, authMethod, isAdmin }` — `authMethod` is `"session"` or `"token"` |
| GET | `/user/me` | — | `{ id, username, role, createdAt, updatedAt }` |
| PATCH | `/user/me` | `{ username }` | the updated user; **409** if the name is taken |
| PUT | `/user/me/password` | `{ currentPassword, newPassword }` | `{ message }`; **400** if the current password is wrong |

Names: 3–32 characters, letters, digits, `.`, `-` and `_`. Passwords: 8–128 characters.

## Your shelf

Each user only ever sees their own shelf — the user comes from the token, never from the
request.

**Statuses:** `PLAYING`, `PAUSED`, `PLAN_TO_PLAY`, `FINISHED_MAIN`, `FINISHED_EXTRAS`,
`COMPLETED_100`, `DROPPED`.
**Shelves** (as on Home): `playing` (PLAYING, PAUSED), `finished` (FINISHED_MAIN,
FINISHED_EXTRAS, COMPLETED_100), `planned` (PLAN_TO_PLAY), `dropped` (DROPPED).

| Method | Route | Query / body | Response |
|---|---|---|---|
| GET | `/library` | `?shelf=finished` and/or `?status=FINISHED_MAIN,COMPLETED_100` | `{ items, counts, total }` |
| GET | `/library/stats` | — | hours, counts, ratings, genres, games finished per year… (below) |
| GET | `/library/discover` | — | a well-rated IGDB game that isn't on your shelf; **404** when there's none |
| GET | `/library/:gameId` | — | `{ entry }` — `null` when the game isn't on the shelf |
| PUT | `/library/:gameId` | `{ status, hoursPlayed?, startedAt?, finishedAt?, rating?, notes?, platform? }` | `{ entry }` — creates or **replaces** the whole entry |
| DELETE | `/library/:gameId` | — | `{ entry: null }`; **404** if it wasn't on the shelf |

`:gameId` is the IGDB id. `items` is newest first; `counts` (every status) and `total`
always describe the whole shelf, whatever the filter.

```json
{
  "items": [
    {
      "gameId": 1942,
      "status": "COMPLETED_100",
      "hoursPlayed": 112.5,
      "rating": 10,
      "notes": "Blood and Wine is the best expansion ever made.",
      "platform": "PlayStation 4",
      "startedAt": "2026-01-04",
      "finishedAt": "2026-03-20",
      "createdAt": "2026-10-09T18:20:11.000Z",
      "updatedAt": "2026-10-10T09:01:44.000Z",
      "game": {
        "id": 1942,
        "name": "The Witcher 3: Wild Hunt",
        "coverUrl": "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
        "year": 2015,
        "platforms": ["PC (Microsoft Windows)", "PlayStation 4"]
      }
    }
  ],
  "counts": { "PLAYING": 1, "PAUSED": 0, "PLAN_TO_PLAY": 4, "FINISHED_MAIN": 5, "FINISHED_EXTRAS": 0, "COMPLETED_100": 2, "DROPPED": 1 },
  "total": 13
}
```

`PUT` body: `status` is required; `hoursPlayed` 0–100,000 (up to 2 decimals);
`startedAt`/`finishedAt` `YYYY-MM-DD` (the end can't be before the start); `rating` 1–10;
`notes` up to 2000 characters; `platform` (where you played it, any text) up to 60.
Whatever isn't sent ends up empty.

`/library/stats` returns `{ total, finished, counts, completionRate, hours: { total,
logged, estimated, … }, backlog, rating: { average, rated, distribution },
finishedPerYear: [{ year, count }], genres: [{ name, count }], platforms: [{ name, count }], topRated, mostPlayed,
factsComplete }`. Hours you didn't log are estimated from IGDB's average times.

## Games (IGDB)

Any signed-in user. Fails with **503** until an admin sets the IGDB key.

| Method | Route | Query | Response |
|---|---|---|---|
| GET | `/games/search` | `q`, `platforms`, `genres`, `themes`, `modes`, `perspectives`, `types`, `yearFrom`, `yearTo`, `minRating`, `sort`, `page`, `pageSize` | `{ items, total, page, pageSize }` |
| GET | `/games/filters` | — | `{ platforms, genres, themes, modes, perspectives, types }`, each `[{ id, name }]` |
| GET | `/games/:id` | — | the full IGDB record: cover, summary, ratings, time to beat, screenshots, videos, DLCs, expansions, series |

Search parameters: `q` up to 100 characters; the lists are comma-separated ids from
`/games/filters` ("any of" inside a list, "and" between lists); `yearFrom`/`yearTo`
1950–2100; `minRating` 0–100; `sort` `relevance`, `popular` (default), `rating`,
`newest`, `oldest` or `name` (ignored when there is text); `page` 1–500; `pageSize`
1–50 (24 by default).

```bash
curl -H "Authorization: Bearer $GTV_TOKEN" "$GTV/games/search?q=hollow%20knight&pageSize=5"
```

## Assistant

Each user's own Claude key and model.

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/ai/settings` | — | `{ provider, configured, keyHint, model, updatedAt }` — the key itself never comes back |
| PUT | `/ai/settings` | `{ apiKey?, model }` | the settings; a new key is tested with Anthropic before it is saved |
| DELETE | `/ai/settings` | — | the settings, without a key |
| POST | `/ai/models` | `{ apiKey? }` | the models the key can use |
| POST | `/ai/chat` | `{ content, conversationId?, language? }` | `{ conversation, question, answer }` — without `conversationId` a new conversation starts; the answer is written on the server |
| GET | `/ai/conversations` | — | `[{ id, title, updatedAt, running }]`, the latest first (up to 100) |
| GET | `/ai/conversations/:id` | — | the conversation with its `messages: [{ id, role, content, tools, error, pending }]` |
| GET | `/ai/conversations/:id/stream` | — | the answer being written, one JSON object per line: `snapshot`, `text`, `tool`, `error`, `ping`, `done` |
| POST | `/ai/conversations/:id/actions/:actionId` | `{ decision }` (`confirm` or `dismiss`) | `{ action }` — confirms (applies to the shelf) or dismisses a change the assistant proposed; 409 if already decided |
| POST | `/ai/conversations/:id/stop` | — | stops the answer being written |
| DELETE | `/ai/conversations/:id` | — | deletes the conversation |
| POST | `/ai/conversations/delete` | `{ ids: [uuid] }` (1–100) | `{ deleted }` — deletes several at once |

Conversations are kept on the server, and the last 40 messages go with each question.
The answer keeps being written if the connection drops: `/stream` first sends a
`snapshot` with what is already written (or, if it has ended, the saved answer) and then
each new piece, until `done`. An `action` line is a shelf change the assistant proposes
(`{ id, kind: 'set' | 'remove', gameId, gameName, coverUrl, change, before, state }`): nothing
changes until it is confirmed with `…/actions/:actionId`. A `ping` line comes every 20 seconds while nothing else
does. `error` is a message, or the code `stopped` or `interrupted` (the server restarted
mid-answer). `language` is `pt-PT`, `en` or `es`.

## Backups (admin)

Database backups (`pg_dump`, gzip), made by the server itself. The automatic one runs
every day at the configured time; old ones are deleted after each backup. Files are named
`gametracker-YYYYMMDD-HHMMSS.sql.gz`.

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/backups` | — | overview: settings, folder, list, last run, next automatic run |
| POST | `/backups` | — | **201** `{ backup: { name, size, createdAt }, removed: [names] }` once the backup is written; **409** if one is already running; **503** without `pg_dump` |
| GET | `/backups/:name/download` | — | the file (`application/gzip`); `:name` can be `latest` |
| DELETE | `/backups/:name` | — | `{ message, name }`; `:name` can be `latest` |
| GET | `/backups/settings` | — | `{ automatic, time, keepDays, directory }` |
| PUT | `/backups/settings` | any of `{ automatic, time, keepDays, directory }` | the saved settings |

Overview (`GET /backups`):

```json
{
  "available": true,
  "tool": "pg_dump (PostgreSQL) 17.6",
  "directory": "/var/backups/gametracker",
  "defaultDirectory": "/var/backups/gametracker",
  "settings": { "automatic": true, "time": "03:30", "keepDays": 14, "directory": null },
  "nextAutomatic": "2026-11-12T03:30:00.000Z",
  "running": false,
  "lastRun": { "at": "2026-11-11T03:30:00.112Z", "ok": true, "error": null, "file": "gametracker-20261111-033000.sql.gz" },
  "totalSize": 1843200,
  "backups": [
    { "name": "gametracker-20261111-033000.sql.gz", "size": 614400, "createdAt": "2026-11-11T03:30:02.481Z" }
  ]
}
```

Settings:

| Field | Values |
|---|---|
| `automatic` | `true` / `false` — the daily backup on or off (manual and API backups always work) |
| `time` | `"HH:MM"` in the server's time zone (the installer uses the Proxmox host's). If the server was off at that time, the backup runs as soon as it starts |
| `keepDays` | 0–3650; backups older than this are deleted after each new one. `0` keeps them all |
| `directory` | an absolute path, created if missing; `null` or `""` goes back to the default (`/var/backups/gametracker`). The backend runs as the `gametracker` user, so a folder of your own (an NFS/SMB share mounted under `/mnt`) must be writable by it — the server checks before saving (**400** otherwise). `/etc`, `/usr` and `/home` are read-only for the service |

Changing the folder doesn't move the existing backups: the list shows the current folder.

Restoring is done on the server, not through the API (it replaces the whole database):

```bash
systemctl stop gametracker
gunzip -c /var/backups/gametracker/gametracker-20261111-033000.sql.gz | runuser -u postgres -- psql -d gametracker
systemctl start gametracker
```

## Version and updates (admin)

| Method | Route | Query / body | Response |
|---|---|---|---|
| GET | `/system/version` | `?lang=pt-PT\|en\|es` | `{ updatesEnabled, installed, latest, updateAvailable, newerCount, offline, update }` |
| GET | `/system/releases` | `?refresh=1&lang=` | `{ updatesEnabled, installed, offline, releases }` — newest first, each with its notes |
| POST | `/system/update` | `{ "version": "v1.5.0" }` | **202** the update's status; **400** if the version doesn't exist or isn't newer; **409** if one is running |
| GET | `/system/update/status` | — | `{ state, target, from, step, message, startedAt, finishedAt, log }` |

`installed` is `{ version, baseVersion, commit, date, branch }`; `version` is the release
tag when the installed code is exactly a release. New releases are fetched from the
repository at most every 5 minutes (`refresh=1` forces it).

`state` goes `queued` → `running` → `success` or `failed`; `step` is `fetch`, `build`,
`migrate`, `publish`, `configure`, `restart` (and `rollback` when a step fails — the
server then goes back to the previous version by itself). The backend restarts during
the update, so expect a few failed requests while it is in `restart`.

Updates only go forward; there is no route to go back to an older version.

## Users (admin)

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/user` | — | every user: `{ id, username, role, createdAt, updatedAt }` |
| POST | `/user` | `{ username, password, role? }` | the new user; `role` is `USER` (default) or `ADMIN` |
| PATCH | `/user/:id` | `{ username?, password?, role? }` | the updated user; **400** when it would leave no admin |
| DELETE | `/user/:id` | — | `{ message }`; you can't delete yourself or the last admin |

## IGDB credentials (admin)

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/integrations/igdb` | — | `{ configured, clientId, secretHint, updatedAt }` |
| PUT | `/integrations/igdb` | `{ clientId, clientSecret? }` | the status; checked with Twitch before saving |
| POST | `/integrations/igdb/test` | — | `{ ok: true }` or `{ ok: false, reason }` |
| DELETE | `/integrations/igdb` | — | the status, unconfigured |

## API tokens (browser only)

These routes work only with the browser session, never with a token (**403**) — a leaked
token can't create more tokens or revoke the others.

| Method | Route | Body | Response |
|---|---|---|---|
| GET | `/tokens` | — | `{ tokens: [{ id, name, prefix, readOnly, expiresAt, expired, lastUsedAt, createdAt }] }` |
| POST | `/tokens` | `{ name, readOnly?, expiresInDays? }` | the token's details plus `token` — the only time it is returned |
| DELETE | `/tokens/:id` | — | `{ message }` |

## Recipes

**Nightly copy of the latest backup** (for example from MyHomeLab or a cron job on
another machine):

```bash
#!/usr/bin/env bash
set -euo pipefail
GTV=https://gametracker.example.com/api
TOKEN=gtv_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # an admin's token
DEST=/srv/backups/gametracker

mkdir -p "$DEST"
# Make a fresh one (or skip this line to fetch the automatic one)
curl -fsS -X POST -H "Authorization: Bearer $TOKEN" "$GTV/backups" > /dev/null
# Download the newest, keeping the server's file name
cd "$DEST" && curl -fsS -OJ -H "Authorization: Bearer $TOKEN" "$GTV/backups/latest/download"
```

`-J` keeps the name the server sends (`gametracker-YYYYMMDD-HHMMSS.sql.gz`).

**Games you have finished:**

```bash
curl -s -H "Authorization: Bearer $GTV_TOKEN" "$GTV/library?shelf=finished" \
  | jq -r '.items[] | "\(.game.name) (\(.finishedAt // "no date"))"'
```

**Update to the latest release when there is one:**

```bash
latest=$(curl -fsS -H "Authorization: Bearer $TOKEN" "$GTV/system/version" \
  | jq -r 'select(.updateAvailable) | .latest.version')
[ -n "$latest" ] && curl -fsS -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"version\":\"$latest\"}" "$GTV/system/update"
```

Then poll `GET /system/update/status` until `state` is `success` or `failed`.

**Home Assistant** (`configuration.yaml`) — hours played as a sensor:

```yaml
rest:
  - resource: https://gametracker.example.com/api/library/stats
    headers:
      Authorization: Bearer gtv_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    scan_interval: 3600
    sensor:
      - name: GamesTracker hours played
        value_template: "{{ value_json.hours.total }}"
        unit_of_measurement: h
```

## Errors

| Code | When |
|---|---|
| 400 | invalid body or query (the message says which field) |
| 401 | no token or cookie, unknown or expired token, deleted user |
| 403 | the route needs an admin; a read-only token on a request that changes something; a token on `/tokens` |
| 404 | the game, entry, user or backup doesn't exist |
| 409 | a duplicate name; a backup or an update already running |
| 429 | the assistant's Anthropic key is being rate-limited |
| 502 | IGDB or Anthropic answered with an error |
| 503 | IGDB not configured or unreachable; backups without `pg_dump`; updates outside the server installation |
