#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# inject-fault.sh
#
# Add or remove Toxiproxy "toxics" against a downstream service to simulate
# real-world failure modes. Each fault manifests as a slow / failed / dropped
# SPAN in Jaeger and a metric movement in Prometheus/Grafana -- with no
# application code changes.
#
# Usage:
#   ./demo/inject-fault.sh <fault> <service> [value]
#   ./demo/inject-fault.sh clear [service]
#   ./demo/inject-fault.sh status
#
# Faults:
#   latency   <service> <ms>     Add fixed latency (default 800ms) -> "slow-db"
#   slowclose <service> <ms>     Delay before closing conn        -> hung backend
#   error     <service>          Drop connections mid-stream       -> 5xx storm
#   down      <service>          Disable proxy entirely            -> hard outage
#   bandwidth <service> <kbps>   Throttle throughput (default 8)   -> noisy neighbor
#   timeout   <service> <ms>     Stall until proxy timeout (default 20000ms)
#   jitter    <service> <ms>     Latency + random jitter           -> flaky network
#
# Services (any one of):
#   user-service course-service content-service quiz-service notification-service
#
# Examples:
#   ./demo/inject-fault.sh latency quiz-service 800
#   ./demo/inject-fault.sh error course-service
#   ./demo/inject-fault.sh bandwidth content-service 16
#   ./demo/inject-fault.sh clear                 # clear all faults, all services
#   ./demo/inject-fault.sh clear quiz-service    # clear one service
#   ./demo/inject-fault.sh status                # show current toxics
# ---------------------------------------------------------------------------
set -euo pipefail

TOXIPROXY_URL="${TOXIPROXY_URL:-http://localhost:8474}"

VALID_SERVICES=(user-service course-service content-service quiz-service notification-service)

die()  { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

require_service() {
  local svc="$1"
  for s in "${VALID_SERVICES[@]}"; do
    [[ "$s" == "$svc" ]] && return 0
  done
  die "unknown service '$svc'. Valid: ${VALID_SERVICES[*]}"
}

# add_toxic <service> <toxic-name> <type> <stream> <json-attributes>
add_toxic() {
  local svc="$1" name="$2" type="$3" stream="$4" attrs="$5"
  # Remove a prior toxic of the same name so re-runs are idempotent.
  curl -sf -X DELETE "${TOXIPROXY_URL}/proxies/${svc}/toxics/${name}" >/dev/null 2>&1 || true
  curl -sf -X POST "${TOXIPROXY_URL}/proxies/${svc}/toxics" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"${name}\",\"type\":\"${type}\",\"stream\":\"${stream}\",\"toxicity\":1.0,\"attributes\":${attrs}}" \
    >/dev/null \
    || die "failed to add toxic '${name}' to '${svc}' (is the proxy registered? run toxiproxy-init.sh)"
}

# proxy_exists <service>  -> 0 if the proxy is registered, non-zero otherwise.
proxy_exists() {
  local svc="$1"
  curl -sf "${TOXIPROXY_URL}/proxies/${svc}" >/dev/null 2>&1
}

# set_enabled <service> <true|false> [--soft]
# With --soft, a failure is non-fatal (used by clear/baseline paths so an
# unregistered proxy never aborts the whole demo run).
set_enabled() {
  local svc="$1" enabled="$2" soft="${3:-}"
  if curl -sf -X POST "${TOXIPROXY_URL}/proxies/${svc}" \
    -H 'Content-Type: application/json' \
    -d "{\"enabled\":${enabled}}" >/dev/null 2>&1; then
    return 0
  fi
  [[ "$soft" == "--soft" ]] && return 0
  die "failed to toggle proxy '${svc}'"
}

clear_service() {
  local svc="$1"
  # A proxy that isn't registered yet has nothing to clear -- that's a healthy
  # baseline, not an error. This keeps `clear`/reset idempotent even against a
  # freshly (re)created stack where toxiproxy-init hasn't run.
  if ! proxy_exists "$svc"; then
    info "proxy '${svc}' not registered yet -> nothing to clear"
    return 0
  fi
  # Re-enable proxy and delete every toxic on it. Soft-enable so a transient
  # blip can't kill the run.
  set_enabled "$svc" true --soft
  local toxics names
  toxics="$(curl -sf "${TOXIPROXY_URL}/proxies/${svc}/toxics" 2>/dev/null || echo '[]')"
  # NOTE: grep exits 1 when there are NO toxics (the healthy baseline). Under
  # `set -euo pipefail` that would abort the whole run, so we capture with a
  # `|| true` guard and only loop when there's something to delete.
  names="$(echo "$toxics" | grep -o '"name":"[^"]*"' | sed 's/"name":"//;s/"//' || true)"
  if [[ -n "$names" ]]; then
    while read -r t; do
      [[ -n "$t" ]] && curl -sf -X DELETE "${TOXIPROXY_URL}/proxies/${svc}/toxics/${t}" >/dev/null 2>&1 || true
    done <<< "$names"
  fi
  info "cleared faults on ${svc}"
}

cmd="${1:-}"; [[ -n "$cmd" ]] || die "no command given. See header for usage."

case "$cmd" in
  latency)
    svc="${2:?service required}"; require_service "$svc"; ms="${3:-800}"
    add_toxic "$svc" "latency_down" "latency" "downstream" "{\"latency\":${ms},\"jitter\":0}"
    info "LATENCY +${ms}ms on ${svc}  ->  expect a fat '${svc}' span in Jaeger"
    ;;
  jitter)
    svc="${2:?service required}"; require_service "$svc"; ms="${3:-400}"
    add_toxic "$svc" "latency_down" "latency" "downstream" "{\"latency\":${ms},\"jitter\":${ms}}"
    info "JITTER ${ms}ms +/-${ms}ms on ${svc}  ->  flaky, variable-latency spans"
    ;;
  slowclose)
    svc="${2:?service required}"; require_service "$svc"; ms="${3:-5000}"
    add_toxic "$svc" "slow_close" "slow_close" "downstream" "{\"delay\":${ms}}"
    info "SLOW_CLOSE ${ms}ms on ${svc}  ->  hung backend / connection lingering"
    ;;
  error)
    svc="${2:?service required}"; require_service "$svc"
    # reset_peer drops the connection immediately -> gateway sees a failed
    # upstream -> emits 5xx + trips its circuit breaker after 5 failures.
    add_toxic "$svc" "reset" "reset_peer" "downstream" "{\"timeout\":0}"
    info "ERROR (conn reset) on ${svc}  ->  5xx storm + circuit breaker will trip"
    ;;
  timeout)
    svc="${2:?service required}"; require_service "$svc"; ms="${3:-20000}"
    # Stall longer than the gateway PROXY_TIMEOUT (15s) -> 504 + truncated span.
    add_toxic "$svc" "stall" "timeout" "downstream" "{\"timeout\":${ms}}"
    info "TIMEOUT stall ${ms}ms on ${svc}  ->  gateway 504, truncated span in Jaeger"
    ;;
  bandwidth)
    svc="${2:?service required}"; require_service "$svc"; kbps="${3:-8}"
    add_toxic "$svc" "bw_down" "bandwidth" "downstream" "{\"rate\":${kbps}}"
    info "BANDWIDTH ${kbps}KB/s cap on ${svc}  ->  noisy-neighbor slowdown"
    ;;
  down)
    svc="${2:?service required}"; require_service "$svc"
    set_enabled "$svc" false
    info "PROXY DISABLED for ${svc}  ->  hard outage (immediate connection refused)"
    ;;
  clear)
    if [[ $# -ge 2 ]]; then
      require_service "$2"; clear_service "$2"
    else
      for s in "${VALID_SERVICES[@]}"; do clear_service "$s"; done
      info "all services back to healthy baseline"
    fi
    ;;
  status)
    for s in "${VALID_SERVICES[@]}"; do
      t="$(curl -sf "${TOXIPROXY_URL}/proxies/${s}/toxics" 2>/dev/null || echo '[]')"
      echo "${s}: ${t}"
    done
    ;;
  *)
    die "unknown command '$cmd'. See header for usage."
    ;;
esac
