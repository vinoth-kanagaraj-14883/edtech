#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT_FILE="${ROOT_DIR}/inventory.ini"

default_user="ubuntu"
default_key="~/.ssh/edtech_key"

declare -a hosts=(
  "api_gateway api-gateway"
  "user_service user-service"
  "course_service course-service"
  "content_service content-service"
  "quiz_service quiz-service"
  "notification_service notification-service"
  "frontend frontend"
  "postgresql postgresql"
  "mysql mysql"
  "redis redis"
  "observability prometheus"
  "observability grafana"
  "observability jaeger"
  "observability otel-collector"
  "observability loki"
)

declare -A entries
for item in "${hosts[@]}"; do
  group="${item%% *}"
  name="${item#* }"
  read -rp "IP for ${name}: " ip
  read -rp "SSH user for ${name} [${default_user}]: " ssh_user
  read -rp "SSH key for ${name} [${default_key}]: " ssh_key
  ssh_user="${ssh_user:-$default_user}"
  ssh_key="${ssh_key:-$default_key}"
  entries["${group}"]+="${name} ansible_host=${ip} ansible_user=${ssh_user} ansible_ssh_private_key_file=${ssh_key}"$'\n'
done

{
  for group in api_gateway user_service course_service content_service quiz_service notification_service frontend postgresql mysql redis observability; do
    echo "[$group]"
    printf "%s" "${entries[$group]}"
    echo
  done

  echo "[databases]"
  printf "%s" "${entries[postgresql]}"
  printf "%s" "${entries[mysql]}"
  printf "%s" "${entries[redis]}"
  echo

  cat <<'GROUPS'
[all_services:children]
api_gateway
user_service
course_service
content_service
quiz_service
notification_service
frontend

[edtech:children]
all_services
databases
observability
GROUPS
} > "$OUT_FILE"

echo "Wrote $OUT_FILE"
