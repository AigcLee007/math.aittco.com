#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/www/backup/aittco/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
PROJECT_ROOT="${PROJECT_ROOT:-/www/wwwroot/aittco}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_ROOT/docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-aittco-db}"
DB_CONTAINER="${DB_CONTAINER:-}"
DB_USER="${DB_USER:-aittcouser}"
DB_NAME="${DB_NAME:-aittcodb}"

TS="$(date +%F_%H%M%S)"
FILE="$BACKUP_DIR/aittcodb_$TS.sql"
LATEST="$BACKUP_DIR/latest.sql"

echo_err() { echo "[db-backup] ERROR: $*" >&2; }

mkdir -p "$BACKUP_DIR"

# 1) 优先按 compose service 找容器 ID
if [ -z "$DB_CONTAINER" ] && [ -f "$COMPOSE_FILE" ]; then
  DB_CONTAINER="$(docker compose -f "$COMPOSE_FILE" ps -q "$DB_SERVICE" 2>/dev/null | head -n1 || true)"
fi

# 2) 回退：按容器名找
if [ -z "$DB_CONTAINER" ]; then
  if docker ps --format '{{.Names}}' | grep -qx "$DB_SERVICE"; then
    DB_CONTAINER="$DB_SERVICE"
  fi
fi

if [ -z "$DB_CONTAINER" ]; then
  echo_err "未找到数据库容器（service=$DB_SERVICE）"
  exit 1
fi

echo "[db-backup] container=$DB_CONTAINER"
echo "[db-backup] writing backup to $FILE"

# 3) 执行备份
if ! docker exec "$DB_CONTAINER" pg_dump -h 127.0.0.1 -p "${DB_PORT:-3339}" -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges > "$FILE"; then
  rm -f "$FILE"
  echo_err "pg_dump 执行失败"
  exit 1
fi

if [ ! -s "$FILE" ]; then
  rm -f "$FILE"
  echo_err "备份文件为空: $FILE"
  exit 1
fi

cp "$FILE" "$LATEST"
find "$BACKUP_DIR" -type f -name 'aittcodb_*.sql' -mtime +"$RETENTION_DAYS" -delete

echo "[db-backup] backup complete"
echo "[db-backup] latest backup: $FILE"
