# chaos-service

A dedicated **chaos server** for the EduForge observability demo. It runs on its
own port (default **8090**) and exposes a JSON API plus a self-contained web
dashboard for injecting faults, then finding them in Jaeger, Prometheus and
Grafana.

It has two independent levers:

| Lever | Mechanism | Needs | Works in |
|-------|-----------|-------|----------|
| **Application scenarios** | Sets `chaos:<kind>:<service>` string keys in Redis (with a TTL). Every EduForge service polls these every 3s and self-injects latency / errors / CPU load / memory leaks. | Redis only | Compose **and** Kubernetes |
| **Kubernetes scenarios** | Calls the Kubernetes API to kill pods, run stress Jobs, apply deny-all NetworkPolicies, and patch Deployments to bad images. | In-cluster RBAC (see below) | Kubernetes only |

If no cluster is reachable, the Kubernetes scenarios return a clear
"kubernetes unavailable" message instead of failing — the application scenarios
keep working.

## The chaos-flag contract

Application services (`payment-service`, `tracking-service`,
`certification-service`, …) each run a 3-second Redis poller that reads:

```
chaos:latency:<service>   -> int milliseconds of latency added per request
chaos:error:<service>     -> int 0-100 percent of requests failed with 503
chaos:cpu:<service>       -> int busy-loop worker threads (CPU pressure)
chaos:memleak:<service>   -> int MB leaked per second
chaos:payment-gateway:down -> flag: payment-service mock PSP hard outage
```

Everything is **fail-open**: if Redis is down, no chaos is injected. Flags carry
a TTL (default 600s, override per-request) so a forgotten experiment self-heals.

## Scenarios (10)

**Application** — `payment-gateway-latency`, `payment-gateway-down`,
`certification-error-storm`, `tracking-cpu-saturation`, `certification-memory-leak`.

**Kubernetes** — `pod-kill`, `cpu-stress`, `memory-oom`, `network-partition`,
`bad-deploy`.

`GET /scenarios` returns each one with its target, blast radius and — most
importantly — `howItShows`: exactly what to watch for in the telemetry.

## API

| Method + path | Purpose |
|---|---|
| `GET /` | Live dashboard — sliders, countdowns, event feed, auto mode, game days |
| `GET /health`, `GET /ready` | Liveness / readiness (readiness reports Redis + k8s) |
| `GET /metrics` | Prometheus metrics |
| `GET /scenarios` | List all scenarios + which are active |
| `POST /scenarios/{name}/start` | Start it. Body: `{"magnitude": N, "duration": secs, "ttl": secs, "target": "svc"}` |
| `POST /scenarios/{name}/stop` | Stop / revert it |
| `GET /status` | Active scenarios (with countdowns), live flags, auto state, playbook progress |
| `GET /events?after=N` | Incremental event feed — everything the engine did, newest last |
| `POST /auto/start` | Start auto mode. Body: `{"intensity": "calm\|normal\|aggressive"}` |
| `POST /auto/stop` | Stop auto mode |
| `GET /playbooks` | List game days + which one is running |
| `POST /playbooks/{name}/run` | Run a multi-step game day |
| `POST /playbooks/cancel` | Cancel the running game day and clear its faults |
| `POST /reset` | Clear **all** chaos flags, stop auto mode, revert all k8s chaos |

## Active chaos: the engine

The service does more than hold on/off switches — it runs chaos on its own.

**Timed experiments.** Pass `duration` and the scenario stops automatically when
the window elapses; the dashboard shows a live countdown. The Redis TTL is only
a fail-safe and is always stretched to outlive an explicit duration.

**Auto mode (chaos monkey).** A background loop keeps picking random scenarios,
runs each for a random window at a randomised magnitude, clears it, and waits.
Three intensities control gap, duration, concurrency and magnitude scale:

| Intensity | Gap between faults | Fault duration | Concurrent |
|---|---|---|---|
| `calm` | 75–150s | 45–90s | 1 |
| `normal` | 35–80s | 60–120s | 2 |
| `aggressive` | 15–40s | 75–150s | 3 |

Magnitudes are randomised ±35% per run, so repeated injections of the same fault
never look identical in the telemetry. Auto mode only picks application
scenarios — it will not kill pods or break deployments on its own.

```bash
curl -XPOST localhost:8090/auto/start -H 'content-type: application/json' \
  -d '{"intensity":"aggressive"}'
curl -XPOST localhost:8090/auto/stop
```

**Game days (playbooks).** Ordered, multi-step incidents that hold each fault so
the effects compound — which is how real outages actually unfold. Every playbook
clears everything it started when it finishes or is cancelled.

| Playbook | Shape | Teaches |
|---|---|---|
| `cascading-failure` | catalog → its callers → gateway | "one service or everything?" triage |
| `checkout-meltdown` | payment slow → notifications back up → provider dies | revenue-impacting incident |
| `learner-journey-degradation` | fault walks down the journey hop by hop | one trace localises the bad stage |
| `silent-degradation` | four services slow, **zero** errors | why uptime checks are not enough |

```bash
curl -XPOST localhost:8090/playbooks/cascading-failure/run
curl -XPOST localhost:8090/playbooks/cancel
```

**Jitter.** Injected latency is not constant — every service spreads it across
roughly 0.55×–1.75× the configured value. A flat delay collapses p50 onto p99
and reads as obviously synthetic; the spread makes the latency histogram behave
like a genuinely degraded dependency. Spans carry both `chaos.latency_ms` (the
actual delay) and `chaos.latency_base_ms` (the configured value).

Example:

```bash
# Slow every checkout by 800ms, then watch payment-service p99 in Grafana
curl -XPOST localhost:8090/scenarios/payment-gateway-latency/start
# Dial it to 2s for 5 minutes
curl -XPOST localhost:8090/scenarios/payment-gateway-latency/start \
  -H 'content-type: application/json' -d '{"magnitude":2000,"ttl":300}'
curl -XPOST localhost:8090/scenarios/payment-gateway-latency/stop
```

## Environment

| Var | Default | Meaning |
|---|---|---|
| `CHAOS_PORT` | `8090` | HTTP port |
| `REDIS_ADDR` | `redis:6379` | Redis for chaos flags |
| `REDIS_PASSWORD` | _(empty)_ | Redis auth |
| `KUBE_NAMESPACE` | `edtech` | Namespace for k8s scenarios |
| `FLAG_TTL_SECONDS` | `600` | Default TTL for chaos flags |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `otel-collector:4317` | Traces for the controller itself |

## Kubernetes RBAC

To run the Kubernetes scenarios, deploy the chaos-service in-cluster with the
manifest in [`k8s/chaos-service.yaml`](k8s/chaos-service.yaml). It creates a
`ServiceAccount` and a namespaced `Role` granting:

* `pods`: get/list/delete (pod-kill)
* `jobs` (batch): get/list/create/delete (cpu-stress, memory-oom)
* `networkpolicies` (networking.k8s.io): get/list/create/delete/update (network-partition)
* `deployments` (apps): get/list/patch (bad-deploy)

This is intentionally scoped to a single namespace. Do **not** grant it
cluster-wide.

## Two ways to do Kubernetes chaos

The built-in Kubernetes scenarios are **imperative** (the controller calls the
API directly) so the demo works with zero extra operators installed. For a
**declarative** alternative using [Chaos Mesh](https://chaos-mesh.org), see
[`k8s-chaos/`](k8s-chaos/) — the same faults expressed as Chaos Mesh CRDs.

## Relationship to `demo/scenarios.sh`

The repo also ships a Toxiproxy-based chaos harness under `demo/` that injects
faults in the **network path** between the gateway and its upstreams. The
chaos-service is complementary: it injects faults **inside** the services
(via the Redis flags they honor) and at the **platform** level (Kubernetes),
and it is driven by an API + dashboard instead of shell scripts.
