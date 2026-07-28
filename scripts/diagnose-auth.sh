#!/bin/sh
# Diagnose and recover the auth/registration path.
# Run from the edtech/ directory:  sh scripts/diagnose-auth.sh
set -e

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.observability.yml"

echo "==================================================================="
echo "1. Container status"
echo "==================================================================="
$COMPOSE ps

echo
echo "==================================================================="
echo "2. user-service logs (last 40 lines)"
echo "==================================================================="
docker logs --tail 40 edtech-user-service 2>&1 || echo "user-service not running"

echo
echo "==================================================================="
echo "3. api-gateway logs (last 40 lines)"
echo "==================================================================="
docker logs --tail 40 edtech-api-gateway 2>&1 || echo "api-gateway not running"

echo
echo "==================================================================="
echo "4. Direct hit: is user-service reachable from the gateway container?"
echo "==================================================================="
docker exec edtech-api-gateway sh -c 'wget -qO- --post-data="{\"email\":\"probe@test.local\",\"password\":\"probepass123\",\"full_name\":\"Probe\",\"role\":\"student\"}" --header="Content-Type: application/json" http://user-service:8001/auth/register || echo "  -> gateway CANNOT reach user-service:8001"' 2>&1 || true

echo
echo "==================================================================="
echo "5. Direct hit on user-service health from host"
echo "==================================================================="
curl -fsS http://localhost:8001/health 2>&1 || echo "  -> user-service /health unreachable on host:8001"
