# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/). The same notes, in English, Portuguese and
Spanish, are in [`releases/`](./releases) and in the app under Admin → Versions.

## [Unreleased]

## [1.1.0] - 2026-11-14

### Added

- **Assistant history**: conversations are kept on the server and listed beside the chat,
  to reopen or delete.
- **Assistant changes your shelf**: ask it to add a game, mark it finished, rate it, log hours
  or remove it, and it proposes the change in a card you confirm or dismiss.
- **Answers keep going** when you leave the page: coming back shows the answer still being
  written, or finished.

## [1.0.1] - 2026-11-13

### Fixed

- Updates and builds no longer stop for an interactive Prisma question.

### Changed

- CI starts the real Docker compose file with PostgreSQL and checks the app answers,
  serves the web app and accepts a login, before anything is released.
- GitHub CodeQL scans the code on every change.

## [1.0.0] - 2026-11-13

First public release.

### Added

- **Library**: a shelf per user with seven statuses (playing, paused, to play, finished,
  finished with extras, 100%, dropped), hours, start and end dates, rating, notes and the
  platform it was played on.
- **Search** over the IGDB catalogue with filters (platforms, genres, themes, game modes,
  perspectives, type, years, minimum score, sorting), and a page for every game with its
  artwork, summary, screenshots, videos and time to beat.
- **Home**: a rotating spotlight on what you are playing, shelves per status with arrows
  and a hover preview, and a random game picker.
- **Stats**: hours, games per status, genre, year and platform, and ratings, using IGDB's
  average times where no hours were logged.
- **Assistant** (optional): chat about games and get recommendations from your shelf,
  using each user's own Anthropic key.
- **Users and roles**: the first account is the admin, who creates the others.
- **API** with personal tokens (full access or read-only) and a public reference
  ([docs/API.md](./docs/API.md)).
- **Backups** of the database on a schedule, with retention, a chosen folder, on-demand
  backups and download.
- **Docker install**: an image for amd64 and arm64 on GitHub Container Registry, a compose
  file with PostgreSQL 17, and a one-command install script.
- **Proxmox install**: a script that creates a Debian 13 container with everything inside,
  in-app updates that roll back on failure, and `gametracker-update` /
  `gametracker-config`.
- **Android app**: a WebView client for your server that updates itself, warns when its
  version and the server's differ, trusts user-installed certificate authorities
  (self-signed servers), and has an F-Droid build without self-update.
- Interface in English, Portuguese and Spanish, with night and day themes.

### Changed

- The project is now **GamesTracker Vault**, licensed under the **GNU AGPL-3.0**, in the
  repository `TTiagoSousa/GamesTracker-Vault`. It continues the private project versioned
  up to 1.6.0, whose history was folded into this release; existing Proxmox installs move
  over with `deploy/proxmox/switch-repo.sh` ([docs/updating.md](./docs/updating.md#moving-from-the-old-repository)).

[Unreleased]: https://github.com/TTiagoSousa/GamesTracker-Vault/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/TTiagoSousa/GamesTracker-Vault/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/TTiagoSousa/GamesTracker-Vault/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/TTiagoSousa/GamesTracker-Vault/releases/tag/v1.0.0
