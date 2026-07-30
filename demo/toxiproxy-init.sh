#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# toxiproxy-init.sh
#
# Registers one Toxiproxy proxy per downstream service. Each proxy listens on a
# dedicated port inside the toxiproxy container and forwards to the real
# service. The api-gateway (see docker-compose.demo.yml) talks to these proxy
# ports, so we can attach/detach "toxics" at runtime to simulate faults.
#
# Idempotent: safe to run multiple times. Existing proxies are deleted and
# recreated so re-runs always converge to a clean baseline.
#
# Usage:
#   ./demo/toxiproxy-init.sh              # uses http://localhost:8474
#   TOXIPROXY_URL=http://host:8474 ./demo/toxiproxy-init.sh
# ---------------------------------------------------------------------------
set -euo pipefail

TOXIPROXY_URL="${TOXIPROXY_URL:-http://localhost:8474}"

# name : listen(inside container) : upstream(real service)
PROXIES=(
  "user-service:0.0.0.0:21001:user-service:8001"
  "course-service:0.0.0.0:21002:course-service:8002"
  "content-service:0.0.0.0:21003:content-service:8003"
  "quiz-service:0.0.0.0:21004:quiz-service:8004"
  "notification-service:0.0.0.0:21005:notification-service:8005"
)

echo "==> Waiting for Toxiproxy admin API at ${TOXIPROXY_URL} ..."
for _ in $(seq 1 30); do
  if curl -sf "${TOXIPROXY_URL}/version" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf "${TOXIPROXY_URL}/version" >/dev/null 2>&1; then
  echo "ERROR: Toxiproxy admin API not reachable at ${TOXIPROXY_URL}" >&2
  echo "       Is the toxiproxy container running? (make demo-up)" >&2
  exit 1
fi

echo "==> Toxiproxy version: $(curl -s "${TOXIPROXY_URL}/version")"

for entry in "${PROXIES[@]}"; do
  name="${entry%%:*}"
  rest="${entry#*:}"
  listen_host="${rest%%:*}"; rest="${rest#*:}"
  listen_port="${rest%%:*}"; rest="${rest#*:}"
  upstream="${rest}"   # host:port

  # Delete if present (ignore 404), then create fresh.
  curl -sf -X DELETE "${TOXIPROXY_URL}/proxies/${name}" >/dev/null 2>&1 || true

  curl -sf -X POST "${TOXIPROXY_URL}/proxies" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"${name}\",\"listen\":\"${listen_host}:${listen_port}\",\"upstream\":\"${upstream}\",\"enabled\":true}" \
    >/dev/null

  echo "    registered proxy  ${name}  (listen ${listen_port} -> ${upstream})"
done

echo "==> Done. All proxies healthy and toxic-free (baseline)."
echo "    List anytime:  curl -s ${TOXIPROXY_URL}/proxies | jq ."
