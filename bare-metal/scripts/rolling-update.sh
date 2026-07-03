#!/bin/bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <inventory-host-or-group>"
  exit 1
fi

SERVICE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
INVENTORY="${ROOT_DIR}/inventory.ini"

echo "[1/4] Pull latest code and rebuild on target via role update tasks"
ansible-playbook -i "${INVENTORY}" -l "${SERVICE}" --tags update "${ROOT_DIR}/ansible/site.yml"

echo "[2/4] Apply configuration and restart if needed"
ansible-playbook -i "${INVENTORY}" -l "${SERVICE}" --tags configure,restart "${ROOT_DIR}/ansible/site.yml"

echo "[3/4] Wait for service to settle"
sleep 5

echo "[4/4] Health check"
"${SCRIPT_DIR}/health-check-vms.sh"
echo "Rolling update finished for ${SERVICE}"
