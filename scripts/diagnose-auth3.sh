#!/bin/sh
# Show the user-service registration traceback, then re-test both paths.
# Run:  sh scripts/diagnose-auth3.sh

echo "=== 1. Trigger a direct registration to generate a fresh traceback ==="
curl -sS -o /dev/null -w "user-service direct status: %{http_code}\n" \
  -X POST http://localhost:8001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"tb@test.local","password":"probepass123","full_name":"TB Probe","role":"student"}'

echo
echo "=== 2. user-service logs (last 50 — look for Traceback) ==="
docker logs --tail 50 edtech-user-service 2>&1

echo
echo "=== 3. Through gateway ==="
curl -sS -i -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"gw2@test.local","password":"probepass123","full_name":"GW2","role":"student"}'
