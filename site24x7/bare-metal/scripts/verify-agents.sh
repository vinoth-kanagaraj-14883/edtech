#!/bin/bash
# verify-agents.sh
# =================
# Check Site24x7 agent status across all hosts in an Ansible inventory.
# Reads an inventory.ini file, SSHes to each VM, and checks agent status.
#
# Usage: ./verify-agents.sh [INVENTORY_FILE]
# Default inventory: ../bare-metal/inventory.ini
#
# Output:
#   HOST                      SERVER AGENT    APM ENV FILE   STATUS
#   api-gateway (10.0.1.10)   ✓ running       ✓ present      OK
#   user-service (10.0.1.11)  ✓ running       ✓ present      OK
set -euo pipefail

INVENTORY="${1:-../bare-metal/inventory.ini}"
SSH_USER="${SSH_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-~/.ssh/edtech_key}"
INSTALL_DIR="${INSTALL_DIR:-/opt/site24x7}"

# ANSI colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

if [[ ! -f "${INVENTORY}" ]]; then
    echo "ERROR: Inventory file not found: ${INVENTORY}" >&2
    echo "Usage: ./verify-agents.sh [inventory.ini]" >&2
    exit 1
fi

echo ""
echo -e "${BOLD}Site24x7 Agent Verification${NC}"
echo -e "Inventory: ${INVENTORY}"
echo "$(date -u)"
echo ""
printf "%-35s %-18s %-18s %-10s\n" "HOST" "SERVER AGENT" "APM ENV FILE" "STATUS"
printf "%-35s %-18s %-18s %-10s\n" "----------------------------" "------------" "------------" "------"

# Parse inventory — extract hostname and ansible_host pairs
while IFS= read -r line; do
    # Skip comments, group headers, and empty lines
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" =~ ^\[ ]] && continue
    [[ -z "${line// /}" ]] && continue

    # Extract hostname and ansible_host
    host=$(echo "${line}" | awk '{print $1}')
    ip=$(echo "${line}" | grep -oP 'ansible_host=\K[^ ]+' || echo "")
    user=$(echo "${line}" | grep -oP 'ansible_user=\K[^ ]+' || echo "${SSH_USER}")

    [[ -z "${ip}" ]] && continue
    [[ "${host}" =~ ^ansible_ ]] && continue

    # SSH checks (with timeout)
    SERVER_STATUS="✗ not found"
    APM_STATUS="✗ not found"
    OVERALL="FAIL"

    if ssh -o StrictHostKeyChecking=no \
           -o ConnectTimeout=5 \
           -o BatchMode=yes \
           -i "${SSH_KEY}" \
           "${user}@${ip}" \
           "systemctl is-active site24x7monagent 2>/dev/null" &>/dev/null; then
        SERVER_STATUS="${GREEN}✓ running${NC}"
    else
        SERVER_STATUS="${RED}✗ stopped${NC}"
    fi

    if ssh -o StrictHostKeyChecking=no \
           -o ConnectTimeout=5 \
           -o BatchMode=yes \
           -i "${SSH_KEY}" \
           "${user}@${ip}" \
           "ls ${INSTALL_DIR}/*-apm.env 2>/dev/null | head -1" &>/dev/null; then
        APM_STATUS="${GREEN}✓ present${NC}"
    else
        APM_STATUS="${YELLOW}– not set${NC}"
    fi

    if [[ "${SERVER_STATUS}" == *"running"* ]]; then
        OVERALL="${GREEN}OK${NC}"
    else
        OVERALL="${RED}FAIL${NC}"
    fi

    printf "%-35s %-28s %-28s %-20s\n" \
        "${host} (${ip})" \
        "$(echo -e "${SERVER_STATUS}")" \
        "$(echo -e "${APM_STATUS}")" \
        "$(echo -e "${OVERALL}")"

done < "${INVENTORY}"

echo ""
echo "Legend:"
echo -e "  ${GREEN}✓ running${NC}  — Site24x7 server agent service is active"
echo -e "  ${RED}✗ stopped${NC}  — Service is not running (check: journalctl -u site24x7monagent)"
echo -e "  ${GREEN}✓ present${NC}  — APM env file exists in ${INSTALL_DIR}/"
echo -e "  ${YELLOW}– not set${NC}  — No APM env file found (run install-apm-*.sh)"
echo ""
echo "For portal verification:"
echo "  https://www.site24x7.com → Infrastructure → Servers"
