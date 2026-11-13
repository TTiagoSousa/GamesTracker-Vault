# Backup and restore

The server dumps the database with `pg_dump` into compressed files,
`gametracker-YYYYMMDD-HHMMSS.sql.gz`. In **Admin → Backups** you choose the time of the
daily backup, how many days to keep and the folder (a mounted NAS share, for example),
make one now and download any of them. Other machines can fetch them through the
[API](./API.md#backups-admin).

A backup holds the whole database: users, shelves, settings and the **encrypted** IGDB
and assistant keys. To read those keys after a restore, the server needs the same
`TOKEN_ENCRYPTION_KEY`, so keep a copy of it next to the backups:

- Docker: the `.env` file;
- Proxmox: `/root/gametracker-credentials.txt` inside the container.

## Docker

Backups are written to the `backups` volume (`/data/backups` in the container).

```bash
# list them
docker compose exec app ls -lh /data/backups

# copy them out
docker compose cp app:/data/backups ./backups

# or mount a host folder instead of the volume, in docker-compose.yml:
#   volumes:
#     - ./backups:/data/backups     # the folder must be writable by uid 1000
```

**Restore** (replaces the current data):

```bash
docker compose stop app
gunzip -c gametracker-20261113-033000.sql.gz \
  | docker compose exec -T db psql -U gametracker -d gametracker
docker compose start app
```

The dump starts with `DROP … IF EXISTS`, so it can be loaded over an existing database.

**Move to another machine:** copy `.env` and the latest backup, run the install there,
then restore. Keep the same `TOKEN_ENCRYPTION_KEY`.

## Proxmox / Debian

Backups go to `/var/backups/gametracker` (14 days by default). A manual one:

```bash
bash /opt/gametracker/deploy/proxmox/backup.sh
```

**Restore:**

```bash
systemctl stop gametracker
gunzip -c /var/backups/gametracker/gametracker-20261113-033000.sql.gz \
  | runuser -u postgres -- psql -d gametracker
systemctl start gametracker
```

Proxmox's own container backups (vzdump) also cover everything at once: database,
settings and the credentials file.

## From Proxmox to Docker (or back)

The database is the same in both. Take a backup on one side, restore it on the other, and
copy `TOKEN_ENCRYPTION_KEY` from the old install into the new one before the first start.
