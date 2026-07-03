#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
INVENTORY="${ROOT_DIR}/inventory.ini"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

check() {
  local host="$1" service="$2" port="$3" path="$4"
  local cmd="systemctl is-active ${service} >/dev/null && curl -sf http://localhost:${port}${path} >/dev/null && ss -tlnp | grep -q ':${port} '"
  if ansible "$host" -i "$INVENTORY" -m shell -a "$cmd" >/dev/null 2>&1; then
    echo -e "${GREEN}OK${NC} ${host} (${service}:${port})"
  else
    echo -e "${RED}FAIL${NC} ${host} (${service}:${port})"
  fi
}

check api_gateway api-gateway 8080 /health
check user_service user-service 8001 /health
check course_service course-service 8002 /health
check content_service content-service 8003 /health
check quiz_service quiz-service 8004 /health
check notification_service notification-service 8005 /health
check frontend frontend 3000 /
