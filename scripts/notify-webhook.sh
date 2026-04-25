#!/usr/bin/env bash
set -euo pipefail

WEBHOOK_URL="${BACKUP_ALERT_WEBHOOK_URL:-}"
TITLE="${1:-Database Backup Alert}"
MESSAGE="${2:-Unknown backup error}"

if [ -z "$WEBHOOK_URL" ]; then
  echo "[backup-alert] BACKUP_ALERT_WEBHOOK_URL is not set; skipping webhook notification"
  exit 0
fi

payload="$(printf '{"title":"%s","message":"%s","host":"%s","time":"%s"}' \
  "$(printf '%s' "$TITLE" | sed 's/"/\\"/g')" \
  "$(printf '%s' "$MESSAGE" | sed 's/"/\\"/g')" \
  "$(hostname)" \
  "$(date '+%F %T')")"

curl -fsS -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$payload" >/dev/null

echo "[backup-alert] Webhook notification sent"
