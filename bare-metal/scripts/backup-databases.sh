#!/bin/bash
set -euo pipefail

BACKUP_DIR="${1:-/var/backups/edtech}"
TIMESTAMP="$(date -u +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"

pg_dump -h "${POSTGRES_HOST:-127.0.0.1}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-user_db}" > "${BACKUP_DIR}/postgres-${TIMESTAMP}.sql"
mysqldump -h "${MYSQL_HOST:-127.0.0.1}" -u "${MYSQL_USER:-root}" -p"${MYSQL_PASSWORD:-}" --databases "${MYSQL_DB:-content_db}" > "${BACKUP_DIR}/mysql-${TIMESTAMP}.sql"

echo "Backups created under ${BACKUP_DIR}"
