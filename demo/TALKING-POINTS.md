# Talking Points — Open-Source Observability (Jaeger + Prometheus) vs Site24x7

Companion to [`../site24x7/docs/comparison.md`](../site24x7/docs/comparison.md).
Use these during the live demo (`RUNBOOK.md`) to connect each scenario to a
business/engineering argument for the OSS stack. Framed for **engineering
leadership and architects**.

> This is not "OSS beats SaaS at everything." It's "for deep root-cause,
> data ownership, and cost-at-scale, the OSS trace-first stack is structurally
> stronger — and it's already running." The dual-stack `comparison.md` remains
> the honest, balanced view.

---

## The three architect-grade arguments

### 1. Full trace fidelity & custom span control
- **Jaeger shows every hop as a span** across 5 languages from one propagated
  W3C trace context. In the `slow-db` scenario you go from "app is slow" to the
  exact guilty span in ~30 seconds.
- OpenTelemetry gives you **full control of span attributes** — attach a tenant
  id, a feature flag, a SQL statement, a queue depth. SaaS APM span enrichment
  is comparatively limited and vendor-shaped.
- **Site24x7 contrast:** per-monitor APM summarises a "transaction" and needs an
  agent on *each* service to correlate. Miss one, and the trace has a blind spot.

### 2. Data ownership & cost at scale
- Traces, metrics, and logs live in **your** Jaeger/Prometheus/Grafana — no
  egress, no per-monitor/per-host metering, full retention control.
- Cost scales with **your infrastructure**, not with a **per-monitor price × 7
  services × N hosts × environments** multiplier. For a 7-service platform across
  dev/staging/prod that multiplier is the whole conversation.
- 100% of the raw telemetry is queryable with **PromQL** — custom business SLIs
  like "enrollments/min" or "quiz-submit error budget" that a fixed SaaS schema
  can't express.

### 3. No vendor lock-in — OpenTelemetry is the standard
- Instrumentation is **OTel**, not a proprietary agent. The same spans can be
  exported to Jaeger today, Tempo/Grafana Cloud tomorrow, or *also* to Site24x7's
  OTLP endpoint — **without re-instrumenting a single service**.
- This de-risks the platform decision: you keep optionality instead of rewriting
  agents when priorities change.

---

## Scenario → argument map

| Scenario | Problem it mirrors | OSS point it proves |
|----------|-------------------|---------------------|
| `healthy` | Normal operations | Rich multi-language trace is free with OTel |
| `slow-db` | Slow query, nothing "down" | One trace = root cause; no per-service hunt (arg 1) |
| `error-storm` | Bad deploy → 5xx | PromQL error-budget SLO you define yourself (arg 2) |
| `cascade` | Failing dep threatens system | Span-level view of resilience/circuit breaker (arg 1) |
| `timeout` | Hung backend → 504 | Truncated spans localize the stall instantly (arg 1) |
| `noisy-neighbor` | Network contention | Custom latency SLIs & histograms in PromQL (arg 2) |
| `retry-storm` | Flaky dep amplified by retries | Retry fan-out visible as repeated child spans (arg 1) |
| `partial-degradation` | Only one feature slow | Isolate the hotspot without touching other teams (arg 1) |

---

## Honest trade-offs (say these too — it builds credibility)

The OSS stack is **not** a free lunch:

- **You operate it.** Prometheus retention, Jaeger storage backend, and Grafana
  upgrades are your responsibility. Site24x7 is turnkey.
- **On-call/paging is not built in.** Alertmanager routes alerts, but human
  on-call schedules and SMS/phone escalation are where Site24x7 genuinely wins
  (see `comparison.md`).
- **Uptime SLA reporting for execs** is more polished out-of-the-box in Site24x7.

**Recommended framing:** run **both**. Engineering lives in Jaeger + Grafana for
deep debugging and custom SLOs; operations use Site24x7 for on-call and executive
uptime reports. This demo proves the OSS half carries the heaviest technical
load — root-cause — at zero licensing cost and zero lock-in.

---

## One-line summary for the exec slide

> *"For finding *why* something broke across our microservices, an open-source,
> OpenTelemetry-based Jaeger + Prometheus stack gives us faster root-cause, full
> data ownership, custom business SLOs, and no vendor lock-in — and it's already
> running on the platform today."*
