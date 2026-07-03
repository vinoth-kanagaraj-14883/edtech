#!/bin/bash
set -euo pipefail

echo "Setting up databases..."

psql_exec() {
    docker compose exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 "$@"
}

if ! psql_exec -tAc "SELECT 1 FROM pg_roles WHERE rolname='edtech'" | grep -q 1; then
    psql_exec -c "CREATE USER edtech WITH PASSWORD 'edtech_password';"
fi

if ! psql_exec -tAc "SELECT 1 FROM pg_database WHERE datname='userdb'" | grep -q 1; then
    psql_exec -c "CREATE DATABASE userdb;"
fi

if ! psql_exec -tAc "SELECT 1 FROM pg_database WHERE datname='coursedb'" | grep -q 1; then
    psql_exec -c "CREATE DATABASE coursedb;"
fi

psql_exec -c "GRANT ALL PRIVILEGES ON DATABASE userdb TO edtech;"
psql_exec -c "GRANT ALL PRIVILEGES ON DATABASE coursedb TO edtech;"

docker compose exec -T mysql mysql -u root -proot_password <<'SQL'
CREATE DATABASE IF NOT EXISTS contentdb;
CREATE DATABASE IF NOT EXISTS quizdb;
CREATE USER IF NOT EXISTS 'edtech'@'%' IDENTIFIED BY 'edtech_password';
GRANT ALL ON contentdb.* TO 'edtech'@'%';
GRANT ALL ON quizdb.* TO 'edtech'@'%';
FLUSH PRIVILEGES;
SQL

echo "Databases ready!"
