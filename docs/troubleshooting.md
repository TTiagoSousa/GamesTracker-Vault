# Troubleshooting

First, the logs:

| Install | Command |
|---|---|
| Docker | `docker compose logs --tail 200 app` (and `db`) |
| Proxmox | `journalctl -u gametracker -n 200` · updates: `/var/lib/gametracker/updates/update.log` · nginx: `/var/log/nginx/error.log` |

`/api/health` answers `{"app":"gametracker-vault","ok":true,"version":"v1.0.0"}` when the
server is up.

## Installing

**`Set DB_PASSWORD in .env` (or JWT_SECRET, TOKEN_ENCRYPTION_KEY)** — the `.env` next to
`docker-compose.yml` is missing or incomplete. Run the install script, or fill it in from
`.env.example`.

**The app container restarts: "The database did not accept the migrations"** — the
database is unreachable or the password changed. `DB_PASSWORD` must be the one the
database was created with; changing it later does not change the database user's
password.

**`permission denied … /data/backups`** — a host folder mounted there must be writable by
uid 1000: `sudo chown 1000:1000 ./backups`.

**Proxmox: "Container failed to start"** — usually a template for another CPU
architecture or a storage without room. The host log (`journalctl -xe`) has the reason.

**Proxmox: "The container has no network/DNS"** — check the bridge, the IP and the
gateway (`pct config <CTID>`), and the DNS server.

## Signing in

**Login seems to work but goes straight back to the login page** — the browser refused
the session cookie. Typical cause: the app is behind HTTPS but the proxy is not trusted,
or the address is mixed (https outside, http inside). Check `X-Forwarded-Proto` and
`TRUST_PROXY` ([reverse-proxy.md](./reverse-proxy.md)).

**Forgot the admin password** — another admin can reset it in Admin → Users. With no
other admin, set a new one in the database:

```bash
# Docker (inside the folder with docker-compose.yml)
docker compose exec app node -e "require('bcrypt').hash(process.argv[1],12).then(console.log)" 'new-password'
docker compose exec db psql -U gametracker -d gametracker \
  -c "UPDATE \"User\" SET \"hashedPassword\"='<hash from above>' WHERE username='admin';"
```

On Proxmox, run the same `node -e …` from `/opt/gametracker/apps/backend` and `psql` as
`runuser -u postgres -- psql -d gametracker`.

## Game search

**Search says the catalogue is not configured, or finds nothing** — add the Twitch Client ID and Client
Secret in Admin → Game catalogue (IGDB) and use **Test**. The Twitch application must be
of type *Confidential*.

**IGDB keys stopped working after a restore or a move** — the new install has a different
`TOKEN_ENCRYPTION_KEY`. Put the old one back, or enter the keys again.

## Backups

**"pg_dump not found: backups are disabled"** — install the PostgreSQL client (the Docker
image already has it) or set `PG_DUMP_PATH`.

**"server version mismatch"** — `pg_dump` is older than the database. The image ships
pg_dump 17 for the `postgres:17` database; keep the database on 17, or point
`PG_DUMP_PATH` at a newer client.

## Updates

**Docker: the Versions page says "repository unreachable"** — the server could not reach
`api.github.com`. Updating with `docker compose pull` still works.

**Proxmox: an update failed** — the app is still on the previous version (the update rolls
back by itself). The reason is at the end of `update.log`; run `gametracker-update` again
once it is fixed.

## Android app

**"Could not reach the server"** — open the same address in the phone's browser. On the
home network use `http://` and the port (`:8080` for Docker). Outside it, the server has
to be reachable from the internet (domain and proxy) or through a VPN.

**"This is not a GamesTracker Vault"** — the address answers, but not with the app:
usually a wrong port or a proxy pointing elsewhere.

**HTTPS with a certificate of your own fails** — install its CA on the phone:
[android.md](./android.md#self-signed-certificates).

**No update offered** — the server must have the newer APK (it comes with each server
release). Help → Check for updates shows what the app found.
