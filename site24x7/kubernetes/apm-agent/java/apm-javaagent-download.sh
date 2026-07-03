#!/bin/bash
# site24x7/kubernetes/apm-agent/java/apm-javaagent-download.sh
#
# Download the Site24x7 Java APM agent JAR.
# Usage: ./apm-javaagent-download.sh [INSTALL_DIR]
#
# Default install directory: /opt/site24x7
# In Kubernetes, this runs as an init container writing to an emptyDir volume.
set -euo pipefail

INSTALL_DIR="${1:-/opt/site24x7}"
# Site24x7 currently distributes a single JAR at the URL below (no versioned URLs).
# Set SITE24X7_JAVA_APM_VERSION for informational display only.
AGENT_VERSION="${SITE24X7_JAVA_APM_VERSION:-latest}"
# Note: Site24x7 does not expose versioned download URLs; 'latest' is always downloaded.
# If you need a specific version, download manually from the Site24x7 portal and place it
# at INSTALL_DIR/apm-agent.jar before running this script.
DOWNLOAD_URL="https://staticdownloads.site24x7.com/APM/Java/site24x7-java-agent.jar"

echo "[site24x7] Downloading Java APM agent..."
echo "  Install dir : ${INSTALL_DIR}"
echo "  Version     : ${AGENT_VERSION}"
echo "  URL         : ${DOWNLOAD_URL}"

mkdir -p "${INSTALL_DIR}"

# Download the agent JAR
if command -v curl &>/dev/null; then
    curl -fsSL -o "${INSTALL_DIR}/apm-agent.jar" "${DOWNLOAD_URL}"
elif command -v wget &>/dev/null; then
    wget -q -O "${INSTALL_DIR}/apm-agent.jar" "${DOWNLOAD_URL}"
else
    echo "ERROR: Neither curl nor wget found. Install one of them." >&2
    exit 1
fi

# Verify the download
if [[ ! -f "${INSTALL_DIR}/apm-agent.jar" ]]; then
    echo "ERROR: Download failed — JAR not found at ${INSTALL_DIR}/apm-agent.jar" >&2
    exit 1
fi

JAR_SIZE=$(du -sh "${INSTALL_DIR}/apm-agent.jar" | cut -f1)
echo "[site24x7] Java APM agent downloaded successfully."
echo "  Path : ${INSTALL_DIR}/apm-agent.jar"
echo "  Size : ${JAR_SIZE}"
echo ""
echo "To use the agent, add to your JVM startup:"
echo "  -javaagent:${INSTALL_DIR}/apm-agent.jar"
echo ""
echo "Or set the environment variable:"
echo "  JAVA_TOOL_OPTIONS=-javaagent:${INSTALL_DIR}/apm-agent.jar"
