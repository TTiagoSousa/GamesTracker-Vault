#!/usr/bin/env bash
# Compressed database dump to /var/backups/gametracker, keeping 14 days — by hand, from
# the console. The automatic daily backup is made by the app itself (Admin → Backups,
# where the time, the days to keep and the folder are set).
#
# Restore:  gunzip -c <file> | runuser -u postgres -- psql -d gametracker
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

file="$BACKUP_DIR/gametracker-$(date +%Y%m%d-%H%M%S).sql.gz"
runuser -u postgres -- pg_dump --clean --if-exists gametracker | gzip > "$file.tmp"
mv "$file.tmp" "$file"
chmod 600 "$file"
# The app lists, serves and prunes the backups as its own user
chown "$APP_USER:$APP_USER" "$BACKUP_DIR" "$file"

find "$BACKUP_DIR" -name 'gametracker-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
msg "Backup: $file ($(du -h "$file" | cut -f1))"
