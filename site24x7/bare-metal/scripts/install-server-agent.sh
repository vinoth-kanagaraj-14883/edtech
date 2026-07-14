#!/bin/bash
# install-server-agent.sh
# ========================
# Install Site24x7 Server Monitoring Agent on Ubuntu 22.04.
# Usage: DEVICE_KEY=your_key ./install-server-agent.sh
#
# Optional env vars:
#   PROXY_HOST  — proxy hostname (if needed)
#   PROXY_PORT  — proxy port
set -euo pipefail

# ── Validation ────────────────────────────────────────────────────────────────
DEVICE_KEY="${DEVICE_KEY:?Error: DEVICE_KEY env var must be set. Example: DEVICE_KEY=abc123 ./install-server-agent.sh}"
PROXY_HOST="${PROXY_HOST:-}"
PROXY_PORT="${PROXY_PORT:-}"

INSTALL_URL="https://staticdownloads.site24x7.com/server/Site24x7_Linux_64bit.install"
TMP_DIR=$(mktemp -d)

cleanup() {
    rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

echo "======================================================"
echo " Site24x7 Server Agent Installer"
echo " Ubuntu 22.04 / x86_64"
echo "======================================================"
echo ""

# ── Check if already installed ────────────────────────────────────────────────
if [[ -f /opt/site24x7monagent/bin/monagent ]]; then
    echo "✓ Site24x7 server agent is already installed."
    echo "  Status: $(/opt/site24x7monagent/bin/monagent status 2>&1 || echo 'unknown')"
    echo ""
    echo "To reinstall, first remove: /opt/site24x7monagent/"
    exit 0
fi

# ── Download installer ────────────────────────────────────────────────────────
echo "Downloading Site24x7 Linux agent installer..."
if command -v curl &>/dev/null; then
    curl -fsSL -o "${TMP_DIR}/Site24x7_Linux_64bit.install" "${INSTALL_URL}"
elif command -v wget &>/dev/null; then
    wget -q -O "${TMP_DIR}/Site24x7_Linux_64bit.install" "${INSTALL_URL}"
else
    echo "ERROR: Neither curl nor wget found. Install one of them." >&2
    exit 1
fi

chmod +x "${TMP_DIR}/Site24x7_Linux_64bit.install"
echo "✓ Installer downloaded."

# ── Build install command ─────────────────────────────────────────────────────
INSTALL_CMD="bash ${TMP_DIR}/Site24x7_Linux_64bit.install -i -key=${DEVICE_KEY}"
if [[ -n "${PROXY_HOST}" && -n "${PROXY_PORT}" ]]; then
    INSTALL_CMD="${INSTALL_CMD} -proxy-server=${PROXY_HOST}:${PROXY_PORT}"
    echo "  Using proxy: ${PROXY_HOST}:${PROXY_PORT}"
fi

# ── Run installer ─────────────────────────────────────────────────────────────
echo "Installing Site24x7 server agent..."
eval "${INSTALL_CMD}"

# ── Enable and start service ──────────────────────────────────────────────────
echo "Enabling and starting site24x7monagent service..."
systemctl enable site24x7monagent
systemctl start site24x7monagent

# ── Verify ────────────────────────────────────────────────────────────────────
sleep 3
if systemctl is-active --quiet site24x7monagent; then
    echo ""
    echo "======================================================"
    echo "✅ Site24x7 server agent installed and running!"
    echo "   Check the portal in 2-3 minutes:"
    echo "   https://www.site24x7.com → Infrastructure → Servers"
    echo "======================================================"
else
    echo "ERROR: site24x7monagent service failed to start." >&2
    echo "Check logs: journalctl -u site24x7monagent -n 50" >&2
    exit 1
fi
