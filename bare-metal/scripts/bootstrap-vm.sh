#!/bin/bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y python3 python3-pip curl wget git unzip software-properties-common ufw fail2ban ca-certificates gnupg lsb-release

getent group edtech >/dev/null || groupadd --system edtech
id -u edtech >/dev/null 2>&1 || useradd -r -g edtech -s /bin/bash -m -d /opt/edtech edtech
mkdir -p /opt/edtech /var/log/edtech
chown -R edtech:edtech /opt/edtech /var/log/edtech

ufw --force enable
ufw allow 22/tcp

systemctl enable fail2ban
systemctl restart fail2ban

echo "Bootstrap complete. Run Ansible from control node."
