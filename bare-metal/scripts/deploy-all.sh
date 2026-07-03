#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ansible-playbook -i "${ROOT_DIR}/inventory.ini" "${ROOT_DIR}/ansible/site.yml"
