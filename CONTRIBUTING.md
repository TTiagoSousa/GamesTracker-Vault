# Contributing to GamesTracker Vault

Thanks for helping. Bug reports, ideas, translations, docs and code are all welcome.

- **Bugs and ideas:** open an [issue](https://github.com/TTiagoSousa/GamesTracker-Vault/issues/new/choose)
  with the template.
- **Security problems:** never in a public issue — see [SECURITY.md](./SECURITY.md).
- **Code:** for anything bigger than a small fix, open an issue first so we agree on the
  approach. Pull requests go to `develop`.

Everyone taking part follows the [code of conduct](./CODE_OF_CONDUCT.md).

## Project layout

```
apps/backend     server: NestJS 11 + Prisma 7 + PostgreSQL   (@gametracker/backend)
apps/frontend    web app: React 19 + Vite + SCSS              (@gametracker/frontend)
apps/android     Android app: native WebView in Java          (Gradle, outside npm)
packages/shared  types and constants used by both sides       (@gametracker/shared)
deploy/docker    compose file, install script, image entrypoint (Dockerfile at the root)
deploy/proxmox   LXC installer, updater, maintenance commands
releases         release notes, one folder per version
docs             user guides, API reference, developer docs (docs/development)
```

npm workspaces with one `package-lock.json` at the root: always install from the root.

## Running it locally

You need **Node 22+** and **PostgreSQL 15+** (a local install or
`docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:17-alpine`).

```bash
git clone https://github.com/TTiagoSousa/GamesTracker-Vault.git
cd GamesTracker-Vault
npm install
cp apps/backend/.env.example apps/backend/.env    # set DATABASE_URL, JWT_SECRET, TOKEN_ENCRYPTION_KEY
echo "VITE_API_URL=/api" > apps/frontend/.env.local
cd apps/backend && npx prisma migrate deploy && cd ../..
npm run dev
```

- Server on **http://localhost:3200**, web app on **http://localhost:5190**. Vite forwards
  `/api/*` to the server without the prefix, as nginx does in production, and listens on
  the local network too (a phone on the same Wi-Fi opens `http://<PC IP>:5190`).
- The first account: on an empty database, `POST /auth/register` creates the admin
  (password of 8+ characters), then registration closes and accounts are created in
  Admin → Users:

  ```bash
  curl -X POST http://localhost:3200/auth/register -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"choose-one"}'
  ```
- Game search needs IGDB keys (Admin → Game catalogue); the assistant needs an Anthropic
  key (Settings → Assistant).
- **Windows:** editing server files while `nest --watch` runs can leave it in a crash loop
  with `EADDRINUSE`. Make the changes, then restart once.

## Commands (at the root)

| Command | What it does |
|---|---|
| `npm run dev` | shared package (watch) + server + web app |
| `npm run dev:backend` / `dev:frontend` | only one side |
| `npm run build` | shared → server → web app |
| `npm run lint` | ESLint on the server and the web app (`npm run lint:fix -w @gametracker/backend` fixes formatting) |
| `npm test` | the server's unit tests (Jest) |
| `npm run typecheck` | TypeScript on both sides |
| `npm run build:android` | builds and signs the Android APK (see below) |
| `npm run release` | release notes, versions and the tag (see below) |

`@gametracker/shared` must be built before the others import it; the `dev*` and `build`
scripts do that. After changing it with the server stopped, run `npm run build:shared`.

CI runs lint, tests, both builds, the Android builds, a Docker build and `shellcheck` on
every pull request.

## Database

- Change `apps/backend/prisma/schema.prisma`, then inside `apps/backend`:
  `npx prisma migrate dev --name <what_changed>`. Commit the migration folder with the
  schema change.
- Never edit a migration that is already in a release: installs apply migrations in order
  and would skip it.
- `npx prisma generate` after touching the schema (`build` does it too).

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) in English,
  with a scope: `feat(library): record the platform`, `fix(android): …`, `docs: …`. The
  release notes and the version bump are generated from them.
- **Language:** code, comments, docs and commits in English. API error messages are in
  Portuguese (shown to users as they are).
- **Interface text** goes through i18next, never straight into JSX. Every key exists in
  `apps/frontend/src/i18n/locales/{pt-PT,en,es}/<namespace>.json`.
- **Server:** controller → service → helper (one function per file) → repository. See
  [docs/development/16-conventions-and-patterns.md](./docs/development/16-conventions-and-patterns.md).
- **Style:** Prettier and ESLint settings are in each app; run `npm run lint` before
  pushing.
- **READMEs:** `README.md` and `README.pt-PT.md` change together. The guides in `docs/`
  are English only.
- **Secrets** never go into git: `.env*` files, keystores and `local.properties` are
  ignored.

## Branches

`develop` (work, pull requests) → `staging` (release candidate) → `main` (released).
Changes move forward by merge; releases are tags on `main`.

## Releases

One version for everything: the root `package.json`, the workspaces and the Android app
(`apps/android/gradle.properties`) share `X.Y.Z`, and the release tag is `vX.Y.Z`.

On an up-to-date `main`:

```bash
npm run release -- --dry-run     # preview the next version and the notes
npm run release -- --prepare     # writes releases/<version>/en.md and sets the version everywhere
#   write releases/<version>/pt-PT.md and es.md (same ### Features / Fixes / Improvements headings)
#   add the version to CHANGELOG.md
npm run build:android            # when the Android app changed: the APK of that version
git add -A && git commit -m "chore(release): vX.Y.Z"
npm run release -- --push        # creates the tag (message = en.md) and pushes it
```

The bump follows the commits since the last release: `feat` → minor,
`fix`/`perf`/`refactor` → patch, `!` or `BREAKING CHANGE` → major (`--version vX.Y.Z`
forces one). Pushing the tag starts the release workflow: the Docker image for amd64 and
arm64 on GHCR, the signed APK, and the GitHub release with the notes.

Installs pick the release up by themselves: Proxmox under Admin → Versions, Docker on the
next `docker compose pull`, Android when the server has the new APK.

## Android app

`apps/android` is a native shell (one Activity with a WebView, no AndroidX, no other
libraries) that opens the server chosen on first launch. Reference:
[docs/development/17-android-app.md](./docs/development/17-android-app.md).

- **Requirements:** JDK 17+ and the Android SDK with `platforms;android-35`
  (`ANDROID_HOME`, or the default SDK folder).
- **Two builds:** `selfupdate` (published; updates itself from the server, has the install
  permission) and `fdroid` (no self-update, no install permission).
  `./gradlew assembleFdroidRelease` inside `apps/android` builds the latter.
- **`npm run build:android`** builds the signed `selfupdate` APK of the current version and
  copies it with `android.json` to `apps/frontend/public/downloads/`, where every server
  serves it. Both files go into the release commit.
- **Signing key:** the first local build creates it in `~/.gametracker/` (outside git).
  Back that folder up: without the same key, phones cannot update the app. The release
  workflow reads the same key from repository secrets (see
  [.github/workflows/release.yml](./.github/workflows/release.yml)).
- The `applicationId` stays `me.homesousa.gametracker`: changing it would make Android
  treat it as another app.

## Installs

- **Docker:** `Dockerfile` (root) and `deploy/docker/`. The image runs the server with
  `WEB_DIR` set, so it also serves the web app and puts the API under `/api`.
- **Proxmox:** `deploy/proxmox/`. `ct-create.sh` runs on the host, `install.sh` inside the
  container; `update.sh` (`gametracker-update`) and `config.sh` (`gametracker-config`) are
  the maintenance commands. Paths inside the container (`/opt/gametracker`,
  `/etc/gametracker`, the `gametracker` service and user) must stay as they are: existing
  installs depend on them.

More in [docs/development/15-deploy-and-environment.md](./docs/development/15-deploy-and-environment.md).

## License

By contributing, you agree that your contributions are licensed under the
[GNU AGPL-3.0](./LICENSE), like the rest of the project.
