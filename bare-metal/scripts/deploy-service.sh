#!/bin/bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <inventory-host-or-group>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVICE="$1"

ansible-playbook -i "${ROOT_DIR}/inventory.ini" "${ROOT_DIR}/ansible/site.yml" -l "${SERVICE}"
