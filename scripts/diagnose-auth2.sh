#!/bin/sh
# Focused auth-path diagnostic. Run:  sh scripts/diagnose-auth2.sh
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.observability.yml"

echo "=== A. Gateway proxy env vars (should be EMPTY) ==="
docker exec edtech-api-gateway env 2>/dev/null | grep -i proxy || echo "(no proxy vars — good)"

echo
echo "=== B. Direct to user-service (bypass gateway) — register ==="
curl -sS -i -X POST http://localhost:8001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"direct@test.local","password":"probepass123","full_name":"Direct Probe","role":"student"}'

echo
echo
echo "=== C. Through gateway — register ==="
curl -sS -i -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"gw@test.local","password":"probepass123","full_name":"GW Probe","role":"student"}'

echo
echo
echo "=== D. Gateway logs (last 25) ==="
docker logs --tail 25 edtech-api-gateway 2>&1

echo
echo "=== E. When was the gateway image last built? ==="
docker inspect -f '{{.Created}}' edtech-api-gateway 2>/dev/null
docker images edtech-api-gateway --format '{{.Repository}} created {{.CreatedSince}}'
