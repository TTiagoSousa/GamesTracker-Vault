#!/usr/bin/env bash
# Moves an existing Proxmox install to the GamesTracker-Vault repository and installs its
# latest release. For containers created before the project moved (they follow
# TTiagoSousa/gametrackervault, whose versions went up to v1.6.0; the new repository
# starts again at v1.0.0 with the same code and the same database).
#
# Inside the container, as root (pct enter <CTID>):
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/GamesTracker-Vault/main/deploy/proxmox/switch-repo.sh)"
#
# What it does: a database backup, points /opt/gametracker at the new repository, drops
# the old version tags (otherwise v1.6.0 would look newer than v1.0.0) and runs
# gametracker-update to the latest release. Data, settings (/etc/gametracker) and backups
# stay. The database migrations are the same, so nothing in the database changes.
# If the update fails, the old repository and its tags are put back.
#
# Optional: REPO_URL (another address for the new repository), VERSION (a release
# instead of the latest).
set -euo pipefail

NEW_URL="${REPO_URL:-https://github.com/TTiagoSousa/GamesTracker-Vault.git}"
APP_DIR="/opt/gametracker"
APP_USER="gametracker"
APP_HOME="/var/lib/gametracker"
export LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH="/usr/local/bin:$PATH"

msg()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run this as root inside the container (pct enter <CTID>)."
[ -d "$APP_DIR/.git" ] || die "$APP_DIR is not a GamesTracker Vault install."
id "$APP_USER" >/dev/null 2>&1 || die "User $APP_USER not found — is this the right container?"

# The repository belongs to the app user; git refuses to work on it as root.
repo() { runuser -u "$APP_USER" -- env HOME="$APP_HOME" git -C "$APP_DIR" "$@"; }

OLD_URL="$(repo remote get-url origin)"
if [ "$OLD_URL" = "$NEW_URL" ]; then
  msg "Already on $NEW_URL — running a normal update."
  exec gametracker-update "${VERSION:-latest}"
fi

msg "Checking $NEW_URL…"
TARGET="${VERSION:-$(repo ls-remote --tags --refs "$NEW_URL" 'v*' \
  | sed 's#.*refs/tags/##' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)}"
[ -n "$TARGET" ] || die "No release found in $NEW_URL."
msg "Will install $TARGET (from $OLD_URL)."

if [ -x "$APP_DIR/deploy/proxmox/backup.sh" ] || [ -f "$APP_DIR/deploy/proxmox/backup.sh" ]; then
  msg "Database backup first…"
  bash "$APP_DIR/deploy/proxmox/backup.sh"
fi

restore_old() {
  warn "Putting the old repository back ($OLD_URL)."
  repo remote set-url origin "$OLD_URL"
  repo tag -l | xargs -r -n 50 runuser -u "$APP_USER" -- env HOME="$APP_HOME" git -C "$APP_DIR" tag -d >/dev/null
  repo fetch --quiet --tags --force origin || true
}

msg "Pointing $APP_DIR at the new repository…"
repo remote set-url origin "$NEW_URL"
repo tag -l | xargs -r -n 50 runuser -u "$APP_USER" -- env HOME="$APP_HOME" git -C "$APP_DIR" tag -d >/dev/null
if ! repo fetch --quiet --tags --prune --force origin; then
  restore_old
  die "Could not fetch $NEW_URL."
fi

msg "Updating to $TARGET…"
if ! FORCE=1 bash "$APP_DIR/deploy/proxmox/update.sh" "$TARGET"; then
  restore_old
  die "The update failed; the app is still on the previous version. Log: $APP_HOME/updates/update.log"
fi

printf '\n\033[1;32mDone:\033[0m this container now follows %s and runs %s.\n' "$NEW_URL" "$TARGET"
printf 'From now on: gametracker-update, or Admin → Versions in the app.\n\n'
