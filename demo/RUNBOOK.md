# EduForge Observability Demo — Live Runbook

**Audience:** Engineering leadership / architects
**Wow moment:** Distributed-trace root-cause in Jaeger vs. "guess-and-hunt" with SaaS APM (Site24x7).
**Duration:** ~20 minutes for the full set; ~7 minutes for the headline `slow-db` scenario alone.

This demo runs entirely on the existing Docker Compose stack. A **Toxiproxy** sidecar
sits between the API gateway and the five downstream services, letting us inject
real production failure modes at the network layer — **without touching any service
code or the observability config**.

---

## 0. One-time setup

```bash
cd edtech

# 1. Bring up the platform + full OSS observability stack + toxiproxy sidecar
make demo-up          # (or the raw compose command in demo/docker-compose.demo.yml)

# 2. Seed the databases (first run only)
make setup-db

# 3. (Optional) Register the toxiproxy proxies manually.
#    The scenario commands auto-register them on first run, so this is only
#    needed for a manual sanity check or troubleshooting.
./demo/toxiproxy-init.sh

# 4. Sanity check
make health
curl -s http://localhost:8474/proxies | jq 'keys'   # 5 proxies listed
```

Endpoints you'll open during the demo:

| Tool | URL | Used for |
|------|-----|----------|
| Jaeger — Search | http://localhost:16686/search | Find + open the guilty trace |
| Jaeger — Monitor | http://localhost:16686/monitor | RED metrics from spans |
| Grafana — SLO | http://localhost:3001/d/edtech-slo | Error-budget burn |
| Grafana — Service detail | http://localhost:3001/d/edtech-service-detail | Per-service p50/p99 |
| Prometheus | http://localhost:9090/targets | Scrape health |

Grafana login: `admin` / `admin`.

---

## 1. Establish "normal" (2 min)

```bash
./demo/scenarios.sh healthy
```

**Say:** *"This is a healthy Tuesday. Let me show you what a single learner action
looks like across our system."*

1. Open **Jaeger → Search**, service `edtech-api-gateway`, click **Find Traces**.
2. Open one trace. Point out the **fan-out across 5 languages** (Go gateway →
   Python user → Java course → Node content → Ruby quiz → Go notification).
3. **Say:** *"Every hop is one span. This is free, standards-based OpenTelemetry —
   no per-service license."*

---

## 2. HEADLINE — `slow-db` root-cause (7 min)

```bash
./demo/scenarios.sh slow-db
```

The script runs baseline traffic for 45s, then injects **+850ms** latency into
`quiz-service`.

**Narrate the incident:**
1. *"Support tickets: 'the quiz page is slow.' Nothing is down. Where do you even start?"*
2. **Grafana → Service detail:** show `quiz-service` p99 jumping while others stay flat.
3. **Jaeger → Search:** service `edtech-api-gateway`, sort by **Longest First**.
4. Open the slowest trace → the **`quiz-service` span is visibly fat**; every other span is tiny.
5. **Click that span → root cause in one screen.** ~30 seconds from ticket to answer.

**The Site24x7 contrast (say this out loud):**
> *"A per-monitor SaaS tool tells us 'the quiz transaction is slow' and shows an
> aggregate chart. To find WHICH of five services (and which DB call) is guilty,
> we'd log into each service's APM view separately — and only if we're paying for
> an agent on every one. Here, one trace answered it, and we own all the data."*

Clear it:
```bash
./demo/scenarios.sh reset
```

---

## 3. `cascade` — resilience story (4 min)

```bash
./demo/scenarios.sh cascade
```

Injects connection resets on `course-service`.

1. **Jaeger:** first you see genuine **error spans** (5xx from the upstream).
2. After 5 consecutive failures the **gateway circuit breaker opens** — subsequent
   spans **fail fast** instead of hanging. Point this out in the trace timeline.
3. **Say:** *"The trace shows our resilience logic protecting the platform in real
   time — a code-level behaviour SaaS dashboards summarise but can't show you
   span-by-span."*

```bash
./demo/scenarios.sh reset
```

---

## 4. Optional rapid-fire scenarios (pick any)

Each is one command; run for ~90s, show the effect, reset.

| Command | Real-world problem | What to point at |
|---------|-------------------|------------------|
| `./demo/scenarios.sh error-storm` | Bad deploy causes 5xx | Grafana SLO burn + red spans |
| `./demo/scenarios.sh timeout` | Backend hangs → 504s | Truncated `content-service` spans |
| `./demo/scenarios.sh noisy-neighbor` | Network contention | Creeping p99, widening spans |
| `./demo/scenarios.sh retry-storm` | Flaky dep + retries | Repeated child spans per request |
| `./demo/scenarios.sh partial-degradation` | One feature slow | Isolated `notification` hotspot |

Always finish with:
```bash
./demo/scenarios.sh reset
```

---

## 5. Screenshot checklist (for the deck)

- [ ] Healthy 5-service trace waterfall (baseline)
- [ ] `slow-db` trace with the fat `quiz-service` span highlighted
- [ ] Grafana Service-detail p99 spike, single service
- [ ] Jaeger Monitor tab RED metrics (derived from spans, no extra instrumentation)
- [ ] `cascade` trace showing fail-fast spans after breaker opens
- [ ] Grafana SLO error-budget burn during `error-storm`

---

## Troubleshooting

- **No traces in Jaeger:** confirm `edtech-otel-collector` and `edtech-jaeger`
  are up (`docker ps`), and that services show `OTEL_EXPORTER_OTLP_ENDPOINT`.
- **Faults have no effect:** re-run `./demo/toxiproxy-init.sh`; verify the gateway
  env points at `toxiproxy:2100x` (`docker exec edtech-api-gateway env | grep SERVICE_URL`).
  (Scenarios auto-register proxies, but re-running init forces a clean baseline.)
- **`Error 1` immediately on a scenario:** the demo stack isn't up. Run `make demo-up`
  first — scenarios refuse to run (with a clear message) if Toxiproxy is unreachable.
- **Circuit breaker won't trip:** it needs ≥5 consecutive upstream failures; keep
  `error`/`cascade` running for at least ~15s of steady traffic.
- **k6 missing:** scripts fall back to a curl traffic loop automatically.
- **Reset everything:** `./demo/scenarios.sh reset` then `./demo/toxiproxy-init.sh`.
