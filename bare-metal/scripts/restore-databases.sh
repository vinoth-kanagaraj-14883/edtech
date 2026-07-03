#!/bin/bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <postgres.sql> <mysql.sql>"
  exit 1
fi

psql -h "${POSTGRES_HOST:-127.0.0.1}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-user_db}" < "$1"
mysql -h "${MYSQL_HOST:-127.0.0.1}" -u "${MYSQL_USER:-root}" -p"${MYSQL_PASSWORD:-}" < "$2"

echo "Restore completed"
