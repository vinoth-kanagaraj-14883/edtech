# Architecture: Dual Observability Model

## Overview

The EdTech platform runs **two complementary observability stacks** simultaneously:

1. **Prometheus + OpenTelemetry + Grafana + Jaeger** — the engineering-facing stack (existing, untouched)
2. **Site24x7** — the operations-facing stack (new, isolated in `site24x7/`)

Both stacks operate independently. Neither replaces nor conflicts with the other.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            EdTech Microservices                               │
│                                                                               │
│  api-gateway(Go)  user-svc(Python)  course-svc(Java)  content-svc(Node.js)  │
│  quiz-svc(Ruby)   notification-svc(Go)   frontend(Next.js)                  │
│       │                 │                    │                │               │
└───────┼─────────────────┼────────────────────┼────────────────┼───────────────┘
        │                 │                    │                │
┌───────▼─────────────────▼────────────────────▼────────────────▼───────────────┐
│                   EXISTING STACK (UNTOUCHED)                                   │
│                                                                                │
│  ┌─────────────────────┐          ┌──────────────────────────────────────┐    │
│  │  OpenTelemetry SDK  │─────────▶│  OTel Collector (otelcol-contrib)    │    │
│  │  (in every service) │          │  Receives: traces, metrics, logs      │    │
│  └─────────────────────┘          └─────┬──────────────┬─────────────────┘    │
│                                         │              │                       │
│                               ┌─────────▼──┐    ┌──────▼─────────┐           │
│                               │  Jaeger     │    │  Prometheus     │           │
│                               │  (traces)  │    │  (metrics)      │           │
│                               └────────────┘    └──────┬──────────┘           │
│                                                        │                       │
│                                                 ┌──────▼──────────┐           │
│                                                 │  Grafana        │           │
│                                                 │  Dashboards/SLO │           │
│                                                 └─────────────────┘           │
└────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                   SITE24X7 STACK (NEW — site24x7/ folder)                    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Site24x7 APM Agents (per language)                                     │ │
│  │  Go: OTel endpoint redirect (zero-code)                                 │ │
│  │  Python: site24x7-apm package                                           │ │
│  │  Java: -javaagent JAR                                                   │ │
│  │  Node.js: require('site24x7-apm')                                       │ │
│  │  Ruby: require 'site24x7'                                               │ │
│  └──────────────────────────────────┬──────────────────────────────────────┘ │
│                                     │                                         │
│  ┌──────────────────────────────────▼──────────────────────────────────────┐ │
│  │  Site24x7 Server Agent (DaemonSet on K8s / systemd on bare metal)       │ │
│  │  CPU · Memory · Disk · Network · Process · K8s cluster metrics          │ │
│  └──────────────────────────────────┬──────────────────────────────────────┘ │
│                                     │                                         │
└─────────────────────────────────────┼───────────────────────────────────────-┘
                                      │ HTTPS (outbound only)
                        ┌─────────────▼──────────────────┐
                        │     Site24x7 Cloud Platform     │
                        │  APM  ·  Infra  ·  K8s Monitor  │
                        │  Synthetic  ·  Log Analytics     │
                        └─────────────┬──────────────────-┘
                                      │ Alerting
                      ┌───────────────▼───────────────────┐
                      │  PagerDuty / Slack / Email / SMS   │
                      └───────────────────────────────────-┘
```

---

## What Each System Monitors

### Site24x7

| Category | What it monitors |
|----------|----------------|
| **Server Health** | CPU, memory, disk, network on every node/VM |
| **APM** | Transaction traces, error rates, apdex, slow queries |
| **K8s Cluster** | Pod status, node conditions, deployment health, events |
| **Synthetic** | Uptime checks, API health endpoints, multi-step transactions |
| **Alerting** | On-call schedules, escalation policies, PagerDuty/Slack integration |
| **Log Analytics** | Log streaming and pattern analysis (optional) |

### Prometheus + OpenTelemetry + Grafana (existing)

| Category | What it monitors |
|----------|----------------|
| **Custom Metrics** | Business metrics, SLI counters, histograms |
| **Distributed Traces** | End-to-end request tracing across all services (Jaeger) |
| **SLO Dashboards** | Error budget burn rate, availability calculations |
| **Log Aggregation** | Structured logs via Loki + Promtail |
| **Alertmanager** | Rule-based alerts on Prometheus metrics |

---

## Why Run Both?

| Use Case | Tool | Reason |
|----------|------|--------|
| "Is the site down?" | Site24x7 | Synthetic checks + on-call paging |
| "Why is it slow?" | Jaeger + Grafana | Distributed traces + custom metrics |
| "What's the error budget?" | Grafana | SLI/SLO dashboards |
| "Is the VM running out of disk?" | Site24x7 | Host-level metrics + alerting |
| "Which SQL query is slow?" | Site24x7 APM | Database query tracing |
| "What's the 99th percentile latency?" | Prometheus/Grafana | Custom histogram metrics |
| "Who gets paged at 3am?" | Site24x7 | On-call schedules + escalation |

---

## Data Flow

### Site24x7 Data Flow

```
Service (instrumented) → Site24x7 APM SDK → Site24x7 Cloud
                                              ├── APM Dashboard
                                              ├── Alert Evaluation
                                              └── On-Call Notification

Host/Node → Site24x7 Server Agent → Site24x7 Cloud
                                     ├── Infra Dashboard
                                     └── Alert Evaluation
```

### Existing OTel Data Flow

```
Service (OTel SDK) → OTel Collector → Jaeger (traces)
                                    → Prometheus (metrics)
                                    → Loki (logs)
                                         └── Grafana (visualization)
                                               └── Alertmanager (alerts)
```

---

## Network Requirements

Site24x7 agents communicate **outbound only** to:
- `https://staticdownloads.site24x7.com` — agent downloads
- `https://apmcollector.site24x7.com` — APM data
- `https://otlp.site24x7.com:4317` — OTel-compatible APM endpoint
- `https://*.site24x7.com` — general agent communication

No inbound ports are required on the monitored hosts.
The existing stack is unaffected — all Prometheus/OTel traffic stays internal.
