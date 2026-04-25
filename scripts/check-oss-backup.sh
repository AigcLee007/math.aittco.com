#!/usr/bin/env bash
set -euo pipefail

LOCAL_DIR="/www/backup/aittco/postgres"
REMOTE_PATH="aliyunoss:aittco-db-backup/postgres"
MAX_AGE_DAYS=8
ALERT_SCRIPT="${ALERT_SCRIPT:-/www/wwwroot/aittco/scripts/notify-webhook.sh}"

LATEST_LOCAL="$LOCAL_DIR/latest.sql"
LATEST_REMOTE_NAME="latest.sql"

alert_and_fail() {
  local message="$1"
  echo "[oss-check] ERROR: $message"
  if [ -x "$ALERT_SCRIPT" ]; then
    "$ALERT_SCRIPT" "OSS 备份巡检失败" "$message" || true
  fi
  exit 1
}

echo "[oss-check] start $(date '+%F %T')"

if [ ! -f "$LATEST_LOCAL" ]; then
  alert_and_fail "本地 latest 备份不存在: $LATEST_LOCAL"
fi

if ! rclone lsf "$REMOTE_PATH" | grep -Fxq "$LATEST_REMOTE_NAME"; then
  alert_and_fail "OSS 上 latest 备份不存在: $REMOTE_PATH/$LATEST_REMOTE_NAME"
fi

latest_file="$(find "$LOCAL_DIR" -maxdepth 1 -type f -name 'aittcodb_*.sql' -printf '%T@ %f\n' | sort -nr | head -n1 | awk '{print $2}')"
if [ -z "${latest_file:-}" ]; then
  alert_and_fail "本地没有找到带时间戳的备份文件: $LOCAL_DIR"
fi

if ! rclone lsf "$REMOTE_PATH" | grep -Fxq "$latest_file"; then
  alert_and_fail "OSS 上缺少最新时间戳备份: $latest_file"
fi

latest_mtime_epoch="$(stat -c %Y "$LOCAL_DIR/$latest_file")"
now_epoch="$(date +%s)"
max_age_seconds=$((MAX_AGE_DAYS * 24 * 60 * 60))

if [ $((now_epoch - latest_mtime_epoch)) -gt "$max_age_seconds" ]; then
  alert_and_fail "本地最新备份已超过 ${MAX_AGE_DAYS} 天: $latest_file"
fi

echo "[oss-check] OK: local and OSS backups are present"
echo "[oss-check] latest local file: $latest_file"
echo "[oss-check] checked remote path: $REMOTE_PATH"
