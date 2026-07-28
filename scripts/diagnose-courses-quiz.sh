#!/bin/sh
# Diagnose courses + quiz flows and print observability URLs.
# Run:  sh scripts/diagnose-courses-quiz.sh
set -e

GW="http://localhost:8080"
EMAIL="diag_$(date +%s)@test.local"
PASS="probepass123"

echo "=== Login/register a test user ==="
curl -sS -o /dev/null -X POST "$GW/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"full_name\":\"Diag\",\"role\":\"student\"}" || true
TOKEN=$(curl -sS -X POST "$GW/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
AUTH="Authorization: Bearer $TOKEN"
echo "token: ${TOKEN%%.*}...(truncated)"

echo
echo "=== COURSES: through gateway ==="
curl -sS -i "$GW/api/courses" -H "$AUTH" | head -20
echo
echo "=== COURSES: direct to course-service (bypass gateway) ==="
curl -sS -i "http://localhost:8002/courses" -H "$AUTH" | head -20

echo
echo "=== QUIZZES: through gateway ==="
curl -sS -i "$GW/api/quizzes" -H "$AUTH" | head -20
echo
echo "=== QUIZZES: direct to quiz-service (bypass gateway) ==="
curl -sS -i "http://localhost:8004/quizzes" -H "$AUTH" | head -20

echo
echo "=== course-service logs (last 30) ==="
docker logs --tail 30 edtech-course-service 2>&1

echo
echo "=== quiz-service logs (last 40) ==="
docker logs --tail 40 edtech-quiz-service 2>&1
