# Install with Docker

The image `ghcr.io/ttiagosousa/gamestracker-vault` holds the server and the web app; the
compose file adds PostgreSQL 17. Images exist for `linux/amd64` and `linux/arm64`
(Raspberry Pi 4/5, Apple silicon hosts, ARM servers).

**You need:** Docker Engine 24+ with the Compose plugin (`docker compose version`), about
1 GB of RAM free and a few GB of disk.

## Quick start (script)

```bash
curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/GamesTracker-Vault/main/deploy/docker/install.sh | bash
```

The script:

1. creates `./gamestracker-vault/` with `docker-compose.yml` and a `.env` with random
   secrets (readable only by you);
2. pulls the images and starts the app and the database;
3. prints the address and the first account (`admin` and a generated password).

Change where it installs, the port or the address with variables in front of `bash`:

```bash
curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/GamesTracker-Vault/main/deploy/docker/install.sh \
  | INSTALL_DIR=/opt/gamestracker PORT=8090 APP_URL=https://games.example.com bash
```

| Variable | Default |
|---|---|
| `INSTALL_DIR` | `./gamestracker-vault` |
| `PORT` | `8080` |
| `APP_URL` | `http://<this machine's IP>:<PORT>` |
| `ADMIN_USERNAME` | `admin` (the password is generated) |
| `TZ` | this machine's time zone |
| `VERSION` | `latest` (image tag) |

Running the script again in the same folder **updates**: it fetches the newest compose
file and image and keeps your `.env`.

## By hand (compose)

```bash
mkdir gamestracker-vault && cd gamestracker-vault
curl -fsSLO https://raw.githubusercontent.com/TTiagoSousa/GamesTracker-Vault/main/deploy/docker/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/GamesTracker-Vault/main/deploy/docker/.env.example -o .env
# fill in DB_PASSWORD, JWT_SECRET, TOKEN_ENCRYPTION_KEY and ADMIN_PASSWORD (see the comments)
docker compose up -d
```

Open `http://<machine>:8080` and sign in with the account from `.env`. Every variable is
described in [configuration.md](./configuration.md).

## What runs

| Service | Image | Data |
|---|---|---|
| `app` | `ghcr.io/ttiagosousa/gamestracker-vault` | backups in the `backups` volume (`/data/backups`) |
| `db` | `postgres:17-alpine` | the database in the `db-data` volume |

- The app container runs as the unprivileged `node` user, applies the database
  migrations on every start and creates the first account only while there are no users.
- It has a health check (`/api/health`): `docker compose ps` shows `healthy` once it is
  ready.
- The web app, the API (`/api`) and the Android APK (`/downloads/`) are all served on the
  same port.

**Keep `.env` safe.** `TOKEN_ENCRYPTION_KEY` encrypts the IGDB and assistant keys stored in
the database; without it they cannot be read back after a restore.

## Next steps

1. Change the admin password: **Settings → Account**.
2. Connect the game catalogue: **Admin → Game catalogue (IGDB)**, with a free
   [Twitch application](https://dev.twitch.tv/console/apps) (type *Confidential*).
3. Domain and HTTPS: [reverse-proxy.md](./reverse-proxy.md).
4. Phones: [android.md](./android.md).
5. Backups: [backup-restore.md](./backup-restore.md).

## Building the image yourself

```bash
git clone https://github.com/TTiagoSousa/GamesTracker-Vault.git
cd GamesTracker-Vault
docker build -t gamestracker-vault:local --build-arg APP_VERSION=dev .
```

Then set `image: gamestracker-vault:local` in `docker-compose.yml`. A build with
`APP_VERSION=dev` reports no release, so the Versions page lists every release as newer.

## Updating

```bash
docker compose pull && docker compose up -d
```

Pin a version with `VERSION=1.0.0` in `.env` to update on your own schedule. More in
[updating.md](./updating.md).
