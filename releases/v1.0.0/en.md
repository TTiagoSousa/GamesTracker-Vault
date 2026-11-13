GamesTracker Vault 1.0.0 — the first public release

### Features
- **open source**: the project is now GamesTracker Vault, under the GNU AGPL-3.0, at github.com/TTiagoSousa/GamesTracker-Vault
- **docker**: an image for amd64 and arm64, a compose file with PostgreSQL and a one-command install script; the Versions page tells Docker installs when a new release is out
- **android**: the app shares the server's version and warns when they no longer match; it accepts certificate authorities you install on the phone (servers with their own certificate); a build for F-Droid without self-update
- **library**: a shelf per person with statuses, hours, dates, rating, notes and the platform you played on
- **search**: the whole IGDB catalogue with filters, and a page for every game
- **home**: a spotlight on what you are playing, shelves with arrows and a random pick
- **stats**, the **assistant**, **backups**, the **API** with tokens, and three languages

### Improvements
- **docs**: guides for Docker, Proxmox, configuration, domains and HTTPS, the Android app, backups, updates and troubleshooting
- **proxmox**: existing containers move to the new repository with one command (deploy/proxmox/switch-repo.sh), keeping all their data
