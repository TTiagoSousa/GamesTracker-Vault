# Updating

Releases follow [semantic versioning](https://semver.org): `vX.Y.Z`, where a new major
version (X) may need something from you, explained in its notes. The server, the web app
and the Android app share the same number. Each release's notes are in the app
(**Admin → Versions**, in your language), in [`CHANGELOG.md`](../CHANGELOG.md) and on the
[GitHub releases](https://github.com/TTiagoSousa/GamesTracker-Vault/releases).

Database migrations run by themselves on every update. Skipping versions is fine.

## Docker

```bash
cd gamestracker-vault
docker compose pull && docker compose up -d
```

Running the install script again does the same and also refreshes `docker-compose.yml`.
To stay on a version, set `VERSION=1.0.0` (or `VERSION=1.0` for patches only) in `.env`.
The Versions page shows when a newer release exists.

## Proxmox / Debian

- In the app: **Admin → Versions → Update**. The progress shows live.
- In the container: `gametracker-update` (latest release), `gametracker-update v1.2.0`
  (a specific one).

It fetches the release, builds it, applies the migrations and restarts. If any step
fails, it goes back to the version that was running. It only moves forward: older
releases are not offered.

## Android

Installed apps offer the new APK by themselves when the server has it. See
[android.md](./android.md#updates).

## Moving from the old repository

Installs made before the project moved to `TTiagoSousa/GamesTracker-Vault` follow the old
repository (`gametrackervault`, versions up to v1.6.0). The new repository starts again at
**v1.0.0** with the same code and the same database, so those installs need one switch.

**Proxmox container** — inside it (`pct enter <CTID>`), as root:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/GamesTracker-Vault/main/deploy/proxmox/switch-repo.sh)"
```

It makes a database backup, points `/opt/gametracker` at the new repository, removes the
old version tags (otherwise v1.6.0 would look newer than v1.0.0) and installs the latest
release. Data, settings and backups stay; if the update fails, the old repository is put
back. From then on, `gametracker-update` and Admin → Versions work as before.

**Android app 1.2.0 or older** — it offers the new app (1.0.0, which is newer for Android
despite the number) as soon as the server is updated.
