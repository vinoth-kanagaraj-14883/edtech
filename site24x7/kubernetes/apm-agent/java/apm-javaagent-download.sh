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
AGENT_VERSION="${SITE24X7_JAVA_APM_VERSION:-latest}"
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
