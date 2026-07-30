#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# scenarios.sh  --  the demo control plane.
#
# Runs one of eight real-world incident scenarios end to end: it generates
# realistic traffic (k6 in the background) and injects the matching fault via
# Toxiproxy, then prints the exact Jaeger + Grafana URLs to open so you can
# narrate the root-cause story live.
#
# Usage:
#   ./demo/scenarios.sh <scenario> [duration]
#   ./demo/scenarios.sh list
#   ./demo/scenarios.sh reset
#
# Scenarios:
#   healthy              Baseline. Clean traces, green SLO. Establish "normal".
#   slow-db              Slow query in quiz-service -> one fat span in Jaeger.
#   error-storm          course-service returns 5xx -> error-budget burn.
#   cascade              Repeated failures trip the gateway circuit breaker.
#   timeout              content-service stalls past the 15s gateway timeout -> 504.
#   noisy-neighbor       content-service bandwidth throttled -> creeping latency.
#   retry-storm          Flaky user-service triggers gateway retries -> span fan-out.
#   partial-degradation  ONE dependency slow, the rest healthy -> isolate the hotspot.
#
# Env:
#   API_URL       gateway URL       (default http://localhost:8080)
#   TOXIPROXY_URL admin API         (default http://localhost:8474)
#   JAEGER_URL    Jaeger UI         (default http://localhost:16686)
#   GRAFANA_URL   Grafana           (default http://localhost:3001)
#   VUS           k6 virtual users  (default 12)
# ---------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_URL="${API_URL:-http://localhost:8080}"
TOXIPROXY_URL="${TOXIPROXY_URL:-http://localhost:8474}"
JAEGER_URL="${JAEGER_URL:-http://localhost:16686}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
VUS="${VUS:-12}"
INJECT="${HERE}/inject-fault.sh"
INIT="${HERE}/toxiproxy-init.sh"

REQUIRED_PROXIES=(user-service course-service content-service quiz-service notification-service)

info()  { echo -e "\n\033[1;36m==> $*\033[0m"; }
note()  { echo -e "    $*"; }
warn()  { echo -e "\n\033[1;31m==> $*\033[0m" >&2; }

# preflight -- make every scenario self-sufficient.
#   1. Verify the Toxiproxy admin API is reachable (i.e. `make demo-up` was run).
#   2. Ensure all per-service proxies are registered; if any are missing,
#      auto-run toxiproxy-init.sh so users no longer need a separate manual step.
preflight() {
  if ! curl -sf "${TOXIPROXY_URL}/version" >/dev/null 2>&1; then
    warn "Toxiproxy admin API not reachable at ${TOXIPROXY_URL}"
    note "The demo stack isn't running. Start it first:"
    note "    make demo-up"
    note "Then re-run this scenario."
    exit 1
  fi

  local registered missing=0
  registered="$(curl -sf "${TOXIPROXY_URL}/proxies" 2>/dev/null || echo '{}')"
  for p in "${REQUIRED_PROXIES[@]}"; do
    echo "$registered" | grep -q "\"${p}\"" || { missing=1; break; }
  done

  if [[ "$missing" -eq 1 ]]; then
    info "Toxiproxy proxies not registered yet -> registering now (one-time)..."
    if ! "$INIT"; then
      warn "Failed to register Toxiproxy proxies via ${INIT}"
      note "Try manually: ./demo/toxiproxy-init.sh"
      exit 1
    fi
  fi
}
urls()  {
  echo -e "\n\033[1;33mOPEN THESE:\033[0m"
  echo    "    Jaeger  (find the trace):  ${JAEGER_URL}/search"
  echo    "    Jaeger  (Monitor / RED):   ${JAEGER_URL}/monitor"
  echo    "    Grafana (SLO burn):        ${GRAFANA_URL}/d/edtech-slo"
  echo    "    Grafana (service detail):  ${GRAFANA_URL}/d/edtech-service-detail"
  echo    "    Prometheus targets:        http://localhost:9090/targets"
}

LOAD_PID=""
start_load() {
  local dur="$1"
  if command -v k6 >/dev/null 2>&1; then
    info "Starting k6 load (${VUS} VUs for ${dur}) in the background..."
    API_URL="$API_URL" VUS="$VUS" DURATION="$dur" k6 run "${HERE}/load.js" \
      >/tmp/edtech-k6.log 2>&1 &
    LOAD_PID=$!
    note "k6 pid ${LOAD_PID}, logs: /tmp/edtech-k6.log"
  else
    info "k6 not found -> falling back to curl traffic loop"
    ( end=$((SECONDS + 120)); while [ $SECONDS -lt $end ]; do
        curl -s "${API_URL}/api/courses"       >/dev/null 2>&1 || true
        curl -s "${API_URL}/api/quizzes"       >/dev/null 2>&1 || true
        curl -s "${API_URL}/api/content"       >/dev/null 2>&1 || true
        curl -s "${API_URL}/api/notifications" >/dev/null 2>&1 || true
        sleep 0.5
      done ) &
    LOAD_PID=$!
  fi
}

cleanup() {
  [[ -n "$LOAD_PID" ]] && kill "$LOAD_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

scenario="${1:-}"
DUR="${2:-2m}"

# Every real scenario (and reset) needs a running, proxy-registered Toxiproxy.
# Run preflight once up front so they're self-sufficient. `list`/help and an
# unknown scenario don't touch Toxiproxy, so they skip preflight.
case "$scenario" in
  healthy|slow-db|error-storm|cascade|timeout|noisy-neighbor|retry-storm|partial-degradation|reset)
    preflight
    ;;
esac

case "$scenario" in
  list|"")
    grep -E '^#   [a-z-]+ ' "$0" | sed 's/^#/ /' || true
    echo
    echo "Usage: ./demo/scenarios.sh <scenario> [duration]"
    exit 0
    ;;

  healthy)
    info "SCENARIO: healthy baseline"
    note "Real-world framing: 'This is a normal Tuesday. All green.'"
    "$INJECT" clear >/dev/null
    start_load "$DUR"
    note "Let traffic run ~60s, then show a clean end-to-end quiz trace."
    urls
    ;;

  slow-db)
    info "SCENARIO: slow-db  (a slow DB query hides in one service)"
    note "Real-world framing: 'Learners say the quiz page is slow. Nothing is DOWN.'"
    "$INJECT" clear >/dev/null
    start_load "$DUR"
    note "Baseline for ~45s so 'normal' latency is visible, THEN injecting..."
    sleep 45
    "$INJECT" latency quiz-service 850
    note "Now: in Jaeger, sort quiz traces by duration -> the quiz-service span is the fat one."
    note "Site24x7 contrast: it flags 'quiz transaction slow' but you still hunt across 5 services."
    urls
    ;;

  error-storm)
    info "SCENARIO: error-storm  (a downstream starts throwing 5xx)"
    note "Real-world framing: 'Course listing intermittently fails after a bad deploy.'"
    "$INJECT" clear >/dev/null
    start_load "$DUR"
    sleep 30
    "$INJECT" error course-service
    note "Grafana edtech-slo: error-budget burn spikes. Jaeger: red error spans on course-service."
    urls
    ;;

  cascade)
    info "SCENARIO: cascade  (failures trip the gateway circuit breaker)"
    note "Real-world framing: 'One failing dependency threatens to take the whole app down.'"
    note "Gateway breaker opens after 5 consecutive failures (CIRCUIT_FAILURE_THRESHOLD)."
    "$INJECT" clear >/dev/null
    start_load "$DUR"
    sleep 30
    "$INJECT" error course-service
    note "Watch: initial 5xx spans -> then FAST-FAIL spans as the breaker opens (protecting the system)."
    note "This is the resilience story SaaS APM can't show at the code level."
    urls
    ;;

  timeout)
    info "SCENARIO: timeout  (a backend stalls past the gateway timeout)"
    note "Real-world framing: 'A dependency hangs; users get 504s.'"
    "$INJECT" clear >/dev/null
    start_load "$DUR"
    sleep 30
    "$INJECT" timeout content-service 20000
    note "Gateway PROXY_TIMEOUT=15s -> 504s. Jaeger: truncated content-service spans."
    urls
    ;;

  noisy-neighbor)
    info "SCENARIO: noisy-neighbor  (bandwidth contention)"
    note "Real-world framing: 'A batch job saturates the network; content loads crawl.'"
    "$INJECT" clear >/dev/null
    start_load "$DUR"
    sleep 30
    "$INJECT" bandwidth content-service 8
    note "Latency creeps up (not a hard error). Grafana p99 climbs; spans widen gradually."
    urls
    ;;

  retry-storm)
    info "SCENARIO: retry-storm  (flaky dependency amplified by retries)"
    note "Real-world framing: 'Intermittent failures trigger retries that amplify load.'"
    "$INJECT" clear >/dev/null
    start_load "$DUR"
    sleep 30
    "$INJECT" jitter user-service 600
    note "Gateway RETRY_MAX_ATTEMPTS retries -> repeated child spans per request in Jaeger."
    urls
    ;;

  partial-degradation)
    info "SCENARIO: partial-degradation  (isolate ONE slow dependency)"
    note "Real-world framing: 'The app feels slow, but only ONE feature is actually affected.'"
    "$INJECT" clear >/dev/null
    start_load "$DUR"
    sleep 30
    "$INJECT" latency notification-service 700
    note "Everything else stays green; only notification spans are fat. Jaeger pinpoints it instantly."
    urls
    ;;

  reset)
    info "Clearing all faults -> healthy baseline"
    "$INJECT" clear
    exit 0
    ;;

  *)
    echo "Unknown scenario: '$scenario'. Run './demo/scenarios.sh list'." >&2
    exit 1
    ;;
esac

info "Scenario running. Press Ctrl-C to stop load and clear faults."
wait "$LOAD_PID" 2>/dev/null || true
info "Load finished. Run './demo/scenarios.sh reset' to clear injected faults."
