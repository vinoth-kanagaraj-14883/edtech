#!/bin/sh
# End-to-end smoke test for all major flows through the API gateway.
# Run from the edtech/ directory:  sh scripts/smoke-test.sh
set -e

GW="http://localhost:8080"
EMAIL="smoke_$(date +%s)@test.local"
PASS="probepass123"

pass() { printf "  \033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "  \033[31mFAIL\033[0m %s\n" "$1"; }

check() {
  # check <description> <actual_status> <expected_status>
  if [ "$2" = "$3" ]; then pass "$1 ($2)"; else fail "$1 (got $2, want $3)"; fi
}

echo "=== 1. Register ($EMAIL) ==="
code=$(curl -sS -o /tmp/reg.json -w '%{http_code}' -X POST "$GW/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"full_name\":\"Smoke Test\",\"role\":\"student\"}")
check "register" "$code" "201"

echo "=== 2. Login ==="
code=$(curl -sS -o /tmp/login.json -w '%{http_code}' -X POST "$GW/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
check "login" "$code" "200"
TOKEN=$(sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p' /tmp/login.json)
if [ -n "$TOKEN" ]; then pass "got access_token"; else fail "no access_token"; fi
AUTH="Authorization: Bearer $TOKEN"

echo "=== 3. Current user (/api/users/me) ==="
code=$(curl -sS -o /tmp/me.json -w '%{http_code}' "$GW/api/users/me" -H "$AUTH")
check "GET /api/users/me" "$code" "200"

echo "=== 4. List courses ==="
code=$(curl -sS -o /tmp/courses.json -w '%{http_code}' "$GW/api/courses" -H "$AUTH")
check "GET /api/courses" "$code" "200"
grep -q '"courses"' /tmp/courses.json && pass "response has courses[] key" || fail "missing courses[] key"
COURSE_ID=$(sed -n 's/.*"id":"\([0-9a-f-]\{36\}\)".*/\1/p' /tmp/courses.json | head -1)

echo "=== 5. Enroll (uses X-User-Id header) ==="
if [ -n "$COURSE_ID" ]; then
  code=$(curl -sS -o /tmp/enroll.json -w '%{http_code}' -X POST "$GW/api/courses/$COURSE_ID/enroll" \
    -H "$AUTH" -H 'Content-Type: application/json' -d "{\"courseId\":\"$COURSE_ID\"}")
  check "POST enroll" "$code" "201"
else
  fail "no course id to enroll (is course-service seeded?)"
fi

echo "=== 6. Enrolled courses (?enrolled=true) ==="
code=$(curl -sS -o /tmp/enrolled.json -w '%{http_code}' "$GW/api/courses?enrolled=true" -H "$AUTH")
check "GET /api/courses?enrolled=true" "$code" "200"

echo "=== 7. List quizzes ==="
code=$(curl -sS -o /tmp/quizzes.json -w '%{http_code}' "$GW/api/quizzes" -H "$AUTH")
check "GET /api/quizzes" "$code" "200"
QUIZ_ID=$(sed -n 's/.*"id":\([0-9]\+\).*/\1/p' /tmp/quizzes.json | head -1)

echo "=== 8. Get single quiz (unwrapped top-level) ==="
if [ -n "$QUIZ_ID" ]; then
  code=$(curl -sS -o /tmp/quiz.json -w '%{http_code}' "$GW/api/quizzes/$QUIZ_ID" -H "$AUTH")
  check "GET /api/quizzes/:id" "$code" "200"
  grep -q '"questions"' /tmp/quiz.json && pass "quiz has questions[] at top level" || fail "no questions[]"
else
  fail "no quiz id (is quiz-service seeded?)"
fi

echo "=== 9. Lessons (via /api/lessons) ==="
code=$(curl -sS -o /tmp/lessons.json -w '%{http_code}' "$GW/api/lessons" -H "$AUTH")
check "GET /api/lessons" "$code" "200"
LESSON_ID=$(sed -n 's/.*"id":"\([0-9a-f-]\{36\}\)".*/\1/p' /tmp/lessons.json | head -1)
if [ -n "$LESSON_ID" ]; then
  code=$(curl -sS -o /tmp/lesson.json -w '%{http_code}' "$GW/api/lessons/$LESSON_ID" -H "$AUTH")
  check "GET /api/lessons/:id" "$code" "200"
  code=$(curl -sS -o /tmp/complete.json -w '%{http_code}' -X POST "$GW/api/lessons/$LESSON_ID/complete" -H "$AUTH")
  check "POST /api/lessons/:id/complete" "$code" "200"
else
  fail "no lesson id (is content-service seeded?)"
fi

echo "=== 10. Notifications collection ==="
code=$(curl -sS -o /tmp/notif.json -w '%{http_code}' "$GW/api/notifications" -H "$AUTH")
check "GET /api/notifications" "$code" "200"

echo
echo "Smoke test complete. Review any FAIL lines above."
