#!/bin/sh
# Entrypoint for chaos-service.
#
# The Docker chaos backend needs to read/write /var/run/docker.sock, but the
# socket is owned by root with mode 660 and its group id differs per host (999
# on many Ubuntu installs, 0 under Docker Desktop / WSL). Hardcoding a GID in
# the image therefore does not work, and running the whole service as root to
# dodge the problem is worse.
#
# So: start as root, discover the socket's actual group, add the unprivileged
# `app` user to it, then drop privileges and exec the real command. `setpriv
# --init-groups` picks up the supplementary group we just created, and exec
# means uvicorn stays PID 1's direct child so SIGTERM still reaches it.
#
# When the socket is absent (Kubernetes, or Compose without the mount) this is a
# no-op and we simply drop privileges — the service then reports the Docker
# backend as unavailable and the Kubernetes/application scenarios still work.
set -e

SOCKET=/var/run/docker.sock

if [ -S "${SOCKET}" ]; then
    SOCKET_GID="$(stat -c '%g' "${SOCKET}")"

    if [ "${SOCKET_GID}" = "0" ]; then
        # Socket is in the root group (common on Docker Desktop / WSL). Adding
        # app to the root *group* still leaves it a non-root user; it does not
        # grant root privileges, only mode-660 group access to this socket.
        usermod -aG root app
        echo "chaos-service: granted app access to ${SOCKET} via root group"
    else
        if ! getent group "${SOCKET_GID}" >/dev/null 2>&1; then
            groupadd -g "${SOCKET_GID}" dockersock
        fi
        SOCKET_GROUP="$(getent group "${SOCKET_GID}" | cut -d: -f1)"
        usermod -aG "${SOCKET_GROUP}" app
        echo "chaos-service: granted app access to ${SOCKET} via group ${SOCKET_GROUP} (gid ${SOCKET_GID})"
    fi
else
    echo "chaos-service: ${SOCKET} not mounted — Docker scenarios will report unavailable"
fi

exec setpriv --reuid=app --regid=app --init-groups "$@"
