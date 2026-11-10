#!/usr/bin/env bash
# Sauvegarde quotidienne : base (pg_dump) + pièces, copie hors du Droplet.
set -euo pipefail

DEST=/var/backups/imf
STAMP="$(date +%Y%m%d-%H%M)"
RETENTION_JOURS=14
mkdir -p "$DEST"

cd /opt/imf/deploy
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U imf -d imf_credit -Fc > "$DEST/db-$STAMP.dump"

find "$DEST" -name 'db-*.dump' -mtime +"$RETENTION_JOURS" -delete
echo "✓ Dump : $DEST/db-$STAMP.dump ($(du -h "$DEST/db-$STAMP.dump" | cut -f1))"

# Copie hors site si un remote rclone "offsite" est configuré (voir documentation/DEPLOIEMENT.md §9).
if command -v rclone >/dev/null && rclone listremotes | grep -q '^offsite:$'; then
  rclone copy "$DEST" offsite:imf-backups/db --max-age 25h
  # "copy" (pas "sync") : une pièce supprimée sur le serveur reste dans la sauvegarde.
  rclone copy /var/lib/imf/uploads offsite:imf-backups/uploads
  echo "✓ Copie hors site terminée"
fi
