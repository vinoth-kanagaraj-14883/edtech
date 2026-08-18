# EduForge Observability — Configuration & Working Flow

> **Purpose of this document:** A complete, ground-truth walkthrough of how the
> EduForge open-source observability stack (**OpenTelemetry + Prometheus +
> Grafana + Jaeger + Alertmanager**) is wired together — how each piece is
> configured, how data flows end-to-end, and how the dashboards are built and
> provisioned. Written to support a study comparing this stack against
> **Site24x7**.

---

## 1. The big picture

EduForge is a **polyglot microservices** platform (Go, Python, Java, Node/TS,
Ruby) fronted by an API gateway. Every service is instrumented with the
**OpenTelemetry (OTel) SDK** and exposes a Prometheus `/metrics` endpoint.

There are **three telemetry signals** and each takes a distinct path:

| Signal | Produced by | Transport | Stored / queried in | Visualized in |
|--------|-------------|-----------|---------------------|---------------|
| **Traces** | OTel SDK in each service | OTLP → OTel Collector → Jaeger | Jaeger | Jaeger UI + Grafana |
| **Metrics (RED / APM)** | (a) app `/metrics` endpoints, (b) spanmetrics connector | Prometheus scrape | Prometheus | Grafana + Jaeger "Monitor" tab |
| **Logs** | stdout (JSON) | OTel logs pipeline (debug) / Promtail→Loki (bare-metal) | Loki (bare-metal only) | Grafana |

```
                         ┌──────────────────────────────────────────────┐
   5 microservices ──▶   │  OTel Collector (otelcol-contrib)             │
   + api-gateway         │  receivers: otlp (4317 gRPC / 4318 HTTP)      │
   + frontend            │  connectors: spanmetrics (RED from spans)     │
   (OTel SDK)            │  exporters: otlp/jaeger, prometheus(:8889)    │
                         └───────┬───────────────────────┬───────────────┘
                                 │ traces                 │ metrics (spanmetrics)
                                 ▼                        ▼
                         ┌───────────────┐        ┌────────────────────┐
                         │   Jaeger      │◀───────│    Prometheus      │
                         │ (all-in-one)  │  SPM   │  scrape :8889 +    │
                         │  UI :16686    │  query │  app /metrics      │
                         └───────────────┘        └─────────┬──────────┘
                                                            │ PromQL
                                 ┌──────────────────────────┼─────────────┐
                                 ▼                          ▼             ▼
                          ┌─────────────┐          ┌──────────────┐  ┌──────────┐
                          │  Grafana    │          │ Alertmanager │  │  Jaeger  │
                          │ dashboards  │          │  (routing)   │  │ Monitor  │
                          └─────────────┘          └──────────────┘  └──────────┘
```

**Two deployment surfaces reuse the same building blocks:**

- **Docker Compose** (`docker-compose.observability.yml` + `observability/*`) —
  the local/demo path.
- **Kubernetes / Helm** (`k8s/`, `helm/`) and **bare-metal** (`bare-metal/ansible`)
  — production-shaped paths that reuse `monitoring/` configs and the *same*
  Grafana dashboard JSON files.

---

## 2. Component inventory (Docker Compose)

Defined in `docker-compose.observability.yml`. It is an **overlay** applied on
top of the base `docker-compose.yml`:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.observability.yml \
  up -d
```

| Container | Image | Ports (host:container) | Role |
|-----------|-------|------------------------|------|
| `edtech-otel-collector` | `otel/opentelemetry-collector-contrib:0.103.1` | `4317:4317`, `4318:4318` | Receive OTLP, fan out traces to Jaeger, derive & export metrics |
| `edtech-prometheus` | `prom/prometheus:v2.54.1` | `9090:9090` | Scrape metrics, evaluate recording/alert rules |
| `edtech-grafana` | `grafana/grafana-oss:11.1.0` | `3001:3000` | Dashboards over Prometheus + Jaeger |
| `edtech-jaeger` | `jaegertracing/all-in-one:1.59` | `16686:16686`, `14250`, `6831/udp`, `6832/udp`, `4319:4317` | Trace store + UI + Service Performance Monitoring |
| `edtech-alertmanager` | `prom/alertmanager:v0.27.0` | `9093:9093` | Alert routing/grouping |

Ports are overridable via env: `PROMETHEUS_PORT`, `GRAFANA_PORT`, `JAEGER_PORT`,
`ALERTMANAGER_PORT`.

---

## 3. Instrumentation: how each service emits telemetry

The overlay injects the collector endpoint into every service. Note the
**protocol split** — some SDKs export OTLP/gRPC (`:4317`), others OTLP/HTTP
(`:4318`):

```yaml
# docker-compose.observability.yml  (env injected per service)
api-gateway:          OTEL_EXPORTER_OTLP_ENDPOINT: otel-collector:4317     # Go, gRPC
user-service:         OTLP_ENDPOINT:               otel-collector:4317     # Python, gRPC
course-service:       OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318  # Java, HTTP
                      OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
content-service:      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318  # Node, HTTP
                      OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
quiz-service:         OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318  # Ruby, HTTP
                      OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
notification-service: OTEL_EXPORTER_OTLP_ENDPOINT: otel-collector:4317     # Go, gRPC
frontend:             OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: http://otel-collector:4318/v1/traces
```

**Two things every service does:**

1. **Exports spans via OTLP** to the collector. Because the gateway propagates
   **W3C `traceparent`** context downstream, a single user action becomes **one
   connected distributed trace** spanning all 5 languages.
2. **Exposes a Prometheus `/metrics` endpoint** that Prometheus scrapes directly
   (this is the *app-owned* metric surface — request counters, histograms, etc.).

> **Frontend nuance:** the browser never talks to the collector directly. It
> POSTs spans to a same-origin Next.js proxy route, which forwards them
> server-side to `http://otel-collector:4318/v1/traces`.

---

## 4. The OpenTelemetry Collector — the hub

File: `observability/otel-collector-config.yml`

```yaml
receivers:
  otlp:
    protocols:
      grpc: { endpoint: 0.0.0.0:4317 }   # Go/Python SDKs
      http: { endpoint: 0.0.0.0:4318 }   # Java/Node/Ruby/Frontend SDKs

connectors:
  # Turns SPANS into RED metrics (request count + latency histogram).
  spanmetrics:
    histogram:
      explicit:
        buckets: [2ms, 8ms, 20ms, 50ms, 100ms, 200ms, 500ms, 1s, 2s, 5s, 10s]
    dimensions:
      - name: http.method
      - name: http.status_code
    metrics_flush_interval: 15s

processors:
  batch: {}

exporters:
  debug: {}
  otlp/jaeger:
    endpoint: jaeger:4317
    tls: { insecure: true }
  prometheus:
    endpoint: 0.0.0.0:8889          # Prometheus scrapes THIS

service:
  pipelines:
    traces:
      receivers:  [otlp]
      processors: [batch]
      exporters:  [otlp/jaeger, debug, spanmetrics]   # ← span goes to Jaeger AND into spanmetrics
    metrics:
      receivers:  [otlp, spanmetrics]                 # ← app OTLP metrics + derived RED metrics
      processors: [batch]
      exporters:  [prometheus]
    logs:
      receivers:  [otlp]
      processors: [batch]
      exporters:  [debug]
```

**Key design idea — the `spanmetrics` connector:**

- Every incoming span is (a) forwarded to Jaeger for trace storage **and**
  (b) fed into the `spanmetrics` connector.
- The connector aggregates spans into **`calls_total`** (a counter) and
  **`duration` histogram** series, tagged with `service.name`, `http.method`,
  `http.status_code`.
- Those derived series are re-emitted on the **metrics pipeline** and exposed on
  the collector's Prometheus exporter (`:8889`).
- This is what powers Jaeger's **Monitor (RED) tab** — RED metrics **without any
  extra app instrumentation**.

So a span does double duty: it's both a **trace** (in Jaeger) and a **metric**
(via spanmetrics → Prometheus → Jaeger Monitor).

---

## 5. Jaeger — traces + Service Performance Monitoring (APM)

File: `docker-compose.observability.yml` (env), UI at `http://localhost:16686`.

```yaml
jaeger:
  environment:
    COLLECTOR_OTLP_ENABLED: "true"
    COLLECTOR_OTLP_GRPC_HOST_PORT: "0.0.0.0:4317"   # bind all ifaces (not localhost)
    COLLECTOR_OTLP_HTTP_HOST_PORT: "0.0.0.0:4318"
    # --- Service Performance Monitoring (the "Monitor" tab) ---
    METRICS_STORAGE_TYPE: prometheus
    PROMETHEUS_SERVER_URL: http://prometheus:9090
    PROMETHEUS_QUERY_NORMALIZE_CALLS: "true"        # match `calls_total`
    PROMETHEUS_QUERY_NORMALIZE_DURATION: "true"     # match duration unit suffixes
```

**Two capabilities:**

1. **Trace search / waterfall** (`/search`) — find a request, open it, see the
   span-by-span waterfall across services. This is the **root-cause** view.
2. **Monitor tab** (`/monitor`) — RED (Rate, Errors, Duration) per service,
   read **from Prometheus** (the spanmetrics series). The two `NORMALIZE_*`
   flags tell Jaeger the collector's Prometheus exporter appends `_total` /
   duration-unit suffixes, so Jaeger queries `calls_total` instead of `calls`.

> **Config gotcha, intentionally handled:** Jaeger's OTLP receiver defaults to
> binding `localhost`, which would reject the collector (a different container).
> The `0.0.0.0` host-port overrides fix this. The demo's `4319:4317` mapping is
> only to avoid a host-port clash with the collector's own `4317`.

---

## 6. Prometheus — scraping & rules

File: `observability/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/recording-rules.yml

scrape_configs:
  - job_name: prometheus     ; targets: ['prometheus:9090']
  - job_name: otel-collector ; targets: ['otel-collector:8889']   # ← spanmetrics + app OTLP metrics
  - job_name: api-gateway    ; metrics_path: /metrics             ; targets: ['api-gateway:8080']
  - job_name: user-service   ; metrics_path: /metrics             ; targets: ['user-service:8001']
  - job_name: course-service ; metrics_path: /actuator/prometheus ; targets: ['course-service:8002']  # Spring Boot
  - job_name: content-service; metrics_path: /metrics             ; targets: ['content-service:8003']
  - job_name: quiz-service   ; metrics_path: /metrics             ; targets: ['quiz-service:8004']
  - job_name: notification-service ; metrics_path: /metrics       ; targets: ['notification-service:8005']
```

**Two metric sources land in Prometheus:**

1. **App-native metrics** — each service's own `/metrics` (course-service uses
   Spring Boot Actuator's `/actuator/prometheus`).
2. **Collector metrics** — the `otel-collector:8889` job pulls the spanmetrics
   RED series (and any OTLP-forwarded app metrics).

### 6.1 The normalization problem the recording rules solve

Every language's HTTP metric has a **different name and label scheme**:

| Service | Metric name | 5xx label |
|---------|-------------|-----------|
| api-gateway (Go) | `api_gateway_http_requests_total` | `status` |
| user-service (Python) | `user_service_http_requests_total` | `status_code` |
| course-service (Java) | `http_server_requests_seconds_count` | `status` |
| content-service (Node) | `http_requests_total{service="content-service"}` | `status_code` |
| quiz-service (Ruby) | `quiz_service_http_requests_total` | `status` |
| notification-service (Go) | `notification_service_http_requests_total` | `status` |

File `observability/recording-rules.yml` collapses all of them into **four
portable series keyed by `job`**, so dashboards are simple and identical across
Compose and K8s:

```
edtech:request_rate:job   # requests/sec (5m)
edtech:error_rate:job     # fraction of 5xx (5m), clamp_min guards divide-by-zero
edtech:latency_p99:job    # p99 seconds (histogram_quantile over *_bucket)
edtech:latency_p50:job    # p50 seconds
```

Example (error rate for the Go gateway):

```promql
- record: edtech:error_rate:job
  expr: |
    sum(rate(api_gateway_http_requests_total{status=~"5.."}[5m]))
    /
    clamp_min(sum(rate(api_gateway_http_requests_total[5m])), 1)
  labels: { job: api-gateway }
```

> This is the crux of the "own your data" story vs Site24x7: because we control
> the recording rules, we can normalize *any* metric shape into a clean SLI
> series that every dashboard and alert reuses.

---

## 7. Grafana — datasources & dashboards (provisioning)

Grafana is **fully provisioned from files** — no click-ops. It mounts two
provisioning trees plus the dashboard JSON:

```yaml
# docker-compose.observability.yml
grafana:
  environment:
    GF_SECURITY_ADMIN_USER: admin
    GF_SECURITY_ADMIN_PASSWORD: admin
    GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH: /var/lib/grafana/dashboards/edtech-overview.json
  volumes:
    - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
    - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
```

### 7.1 Datasources — `monitoring/grafana/provisioning/datasources/datasources.yaml`

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    uid: prometheus          # ← dashboards reference this stable uid
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
    editable: false
  - name: Jaeger
    uid: jaeger
    type: jaeger
    url: http://jaeger:16686
    editable: false
```

The **stable `uid`s** (`prometheus`, `jaeger`) are important: every dashboard
panel targets `"datasource": { "type": "prometheus", "uid": "prometheus" }`, so
the JSON is portable across environments without re-binding.

### 7.2 Dashboard provider — `.../provisioning/dashboards/dashboards.yaml`

```yaml
apiVersion: 1
providers:
  - name: edtech-dashboards
    folder: EdTech
    type: file
    updateIntervalSeconds: 30        # hot-reload edited JSON every 30s
    options:
      path: /var/lib/grafana/dashboards
```

### 7.3 The dashboard set — `monitoring/grafana/dashboards/*.json`

| File / UID | Title | What it shows |
|------------|-------|---------------|
| `edtech-overview` | Platform Overview (default home) | Service health (`up`), request rate, 5xx error rate, p50/p99 — **all services** |
| `edtech-slo` | SLO / Golden Signals | Availability SLI, worst p99, total RPS, **error-budget burn rate** (Google SRE multi-window), per-service bargauges |
| `edtech-service-detail` | Service Detail | Drill-down for **one** service via a `$service` template variable |
| `edtech-http-l7` | HTTP L7 | Layer-7 HTTP breakdown |
| `edtech-app-runtime` | App Runtime | Process CPU / memory / runtime internals |
| `edtech-infra-nodes` | Infra Nodes | Node-level (node-exporter) |
| `edtech-infra-k8s` | Infra K8s | Kubernetes (kube-state-metrics / cAdvisor) |

**How a panel is built (anatomy):** a Grafana panel is JSON with a `datasource`,
a `targets[]` array of PromQL `expr`s, a visualization `type`, and a
`fieldConfig` (units/thresholds). Example from `edtech-overview.json`:

```json
{
  "datasource": { "type": "prometheus", "uid": "prometheus" },
  "targets": [
    { "expr": "edtech:error_rate:job", "legendFormat": "{{job}}", "refId": "A" }
  ],
  "fieldConfig": { "defaults": { "unit": "percentunit", "min": 0, "max": 1 } },
  "title": "Error Rate per Service (5xx)",
  "type": "timeseries"
}
```

Notice every panel queries the **normalized recording rules** (`edtech:*`), not
raw per-language metrics — that's why the dashboards are short and identical
everywhere.

**SLO dashboard highlights (`edtech-slo.json`):**

```promql
# Availability SLI (all services)
1 - avg(edtech:error_rate:job)

# Error-budget burn rate vs a 99.9% target (>1 = burning budget; 14.4 = page)
avg(edtech:error_rate:job) / (1 - 0.999)
```

**Service Detail template variable (`edtech-service-detail.json`):**

```json
"templating": { "list": [{
  "name": "service",
  "query": "label_values(up{job=~\"api-gateway|user-service|course-service|content-service|quiz-service|notification-service\"}, job)",
  "type": "query"
}]}
```
Panels then filter with `edtech:latency_p99:job{job=\"$service\"}`.

### 7.4 How a dashboard is deployed — provisioning vs the Grafana API

**Short answer: this repo deploys dashboards via file-based *provisioning*, NOT
via Grafana's HTTP API.** The dashboard JSON file *is* the deployment artifact.
Grafana reads it off disk at boot and hot-reloads it — no `curl`, no API token,
no import click.

> Grafana *does* expose a REST API for dashboards
> (`POST /api/dashboards/db`), and it's a valid alternative. But provisioned
> dashboards are treated as **read-only** from the API/UI (edits don't persist —
> the next reload overwrites them). This repo chose provisioning because it is
> declarative, versioned in Git, and identical across Docker Compose and K8s.

**The three ingredients (mounted into three paths in the container):**

| Container path | Source file(s) | What it does |
|----------------|----------------|--------------|
| `/etc/grafana/provisioning/datasources/datasources.yaml` | `datasources.yaml` | Registers Prometheus/Jaeger/Loki with stable `uid`s at boot |
| `/etc/grafana/provisioning/dashboards/dashboards.yaml` | `dashboards.yaml` | The **dashboard provider**: `type: file` → "scan a folder for `*.json`" |
| `/var/lib/grafana/dashboards/*.json` | the dashboard models | The actual panels/queries Grafana loads |

**The boot/lifecycle flow (what happens "in the backend"):**

```
JSON file on disk  ──(bind-mount or ConfigMap)──▶  container filesystem
        │
        ▼
Grafana provisioning service starts, reads dashboards.yaml (provider, type=file)
        │  walks options.path, re-scans every updateIntervalSeconds (30s)
        ▼
For each *.json:  parse dashboard model  ──▶  UPSERT into Grafana's internal DB
        │                                        (keyed by the "uid" in the JSON)
        ▼
Dashboard appears in UI under folder "EdTech" / "EduForge";
panel datasources resolved by uid ("prometheus", "jaeger")
```

Why every dashboard JSON has a fixed `"uid"` (e.g. `edtech-overview`): it makes
the load **idempotent** — re-provisioning upserts the same record instead of
creating duplicates, and gives stable deep-link URLs (`/d/edtech-slo`).

**Provider knobs and their effect:**

| Field | Value here | Effect |
|-------|-----------|--------|
| `type` | `file` | Load from a directory (vs the API) |
| `options.path` | `/var/lib/grafana/dashboards` | Folder Grafana scans |
| `updateIntervalSeconds` | `30` | Re-scan every 30s → **edit JSON = hot reload, no restart** |
| `editable` | `true` | UI edits allowed but **not persisted to file** (reload wins) |
| `disableDeletion` | `false` | Deleting the JSON removes the dashboard |
| `folder` | `EdTech` / `EduForge` | Grafana folder the dashboards land in |
| `GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH` (env) | `.../edtech-overview.json` | Sets the landing dashboard by path |

**How the JSON reaches disk differs per deployment (but the JSON is identical):**

*Docker Compose* — bind-mount the host folder directly:
```yaml
grafana:
  volumes:
    - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
    - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
```

*Kubernetes* — Kustomize packs the **same** JSON files into a ConfigMap, which is
then mounted as the dashboards volume (`k8s/base/kustomization.yaml`):
```yaml
configMapGenerator:
  - name: grafana-dashboards
    namespace: monitoring
    files:
      - ../../monitoring/grafana/dashboards/edtech-overview.json
      - ../../monitoring/grafana/dashboards/edtech-slo.json
      # ...same files Docker Compose mounts → Compose and k8s never drift
generatorOptions:
  disableNameSuffixHash: true      # stable ConfigMap name (no hash suffix)
```
```yaml
# k8s/base/monitoring/grafana-deployment.yaml (excerpt)
volumeMounts:
  - { name: datasources,         mountPath: /etc/grafana/provisioning/datasources }
  - { name: dashboard-providers, mountPath: /etc/grafana/provisioning/dashboards }
  - { name: dashboards,          mountPath: /var/lib/grafana/dashboards }
volumes:
  - { name: dashboards, configMap: { name: grafana-dashboards } }
```
In K8s the provider `dashboards.yaml` and `datasources.yaml` are themselves
delivered as ConfigMaps (`grafana-dashboard-providers`, `grafana-datasources`).

### 7.5 (Alternative) Deploying the same JSON via the Grafana HTTP API

Not used in this repo, but for your comparison notes — the imperative path would
be a one-shot POST per dashboard (needs Grafana up + an admin token/basic-auth):

```bash
# Wrap the raw dashboard model in the API envelope and upsert it.
curl -sS -u admin:admin \
  -H 'Content-Type: application/json' \
  -X POST http://localhost:3001/api/dashboards/db \
  -d "$(jq '{dashboard: ., overwrite: true, folderId: 0}' \
         monitoring/grafana/dashboards/edtech-overview.json)"
```

Trade-offs vs provisioning:

| | File provisioning (this repo) | HTTP API (`/api/dashboards/db`) |
|--|-------------------------------|----------------------------------|
| Style | Declarative, GitOps-friendly | Imperative, scripted |
| Requires Grafana running | No (loaded at boot) | Yes |
| Auth needed | No | Yes (token/basic-auth) |
| UI-editable & saved | No (reload overwrites) | Yes (persists in DB) |
| Idempotent | Yes (upsert by `uid`) | Yes only if `overwrite:true` |
| Drift risk | None (single JSON source) | Higher (DB can diverge from Git) |

## 8. Alerting — Prometheus rules → Alertmanager

**Docker Compose path** (`observability/alertmanager.yml`) is intentionally
minimal — a single default receiver, no notifier wired (demo-friendly):

```yaml
route:
  receiver: default-receiver
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 1m
  repeat_interval: 4h
receivers:
  - name: default-receiver
```

**Production path** (`monitoring/prometheus/rules.yml`, used by K8s/bare-metal)
adds real alert rules wired to Alertmanager (`monitoring/prometheus/prometheus.yml`
has `alerting.alertmanagers → alertmanager:9093`):

```yaml
- alert: HighErrorRate
  expr: error_rate_5m > 0.05
  for: 5m
  labels: { severity: critical }

- alert: HighP99Latency
  expr: p99_latency > 2
  for: 5m
  labels: { severity: warning }

- alert: ServiceDown
  expr: up{job=~"api-gateway|user-service|...|alertmanager"} == 0
  for: 2m
  labels: { severity: critical }
```

> **Two rule dialects exist by design.** `observability/recording-rules.yml`
> uses **explicit per-service records** (`edtech:*`). `monitoring/prometheus/rules.yml`
> uses **regex `__name__` matchers** (`request_rate_5m`, `error_rate_5m`,
> `p99_latency`) to catch any of several metric-name conventions in one rule —
> handy when the K8s scrape labels differ.

---

## 9. Docker Compose vs Kubernetes/bare-metal (same bricks, different mortar)

| Concern | Docker Compose | Kubernetes / bare-metal |
|---------|----------------|-------------------------|
| Prometheus config | `observability/prometheus.yml` | `monitoring/prometheus/prometheus.yml` (adds `node-exporter`, `cadvisor`, external `cluster` label, Alertmanager) |
| Rules | `observability/recording-rules.yml` (explicit) | `monitoring/prometheus/rules.yml` (regex + alerts) |
| Collector Prometheus port scraped | `:8889` | `:9464` (see note) |
| Grafana dashboards | `monitoring/grafana/dashboards/*.json` (mounted) | **same JSON files**, loaded via kustomize `configMapGenerator` (`k8s/base/kustomization.yaml`) |
| Logs | OTel `debug` exporter | Promtail → Loki (`bare-metal/ansible` roles) |
| Extra signals | — | eBPF (Hubble/Falco) under `monitoring/ebpf/` |

> **⚠️ Consistency note to verify during your study:** the collector's
> Prometheus exporter is defined at **`:8889`** in
> `observability/otel-collector-config.yml`, and `observability/prometheus.yml`
> correctly scrapes `otel-collector:8889`. However
> `monitoring/prometheus/prometheus.yml` scrapes `otel-collector:9464`. If the
> K8s collector still exports on `8889`, the spanmetrics job would be **down**
> there. This is the one place the two stacks diverge — worth confirming against
> the K8s collector manifest before drawing comparison conclusions.

---

## 10. End-to-end data flow (trace of one request)

1. A learner hits `/api/quizzes`. **api-gateway** (Go) starts a span and
   propagates `traceparent` to **quiz-service** (Ruby), which may fan out to
   **notification-service** (Go).
2. Each service's OTel SDK exports its spans via OTLP to the **collector**
   (gRPC `:4317` or HTTP `:4318`).
3. The collector's **traces pipeline** forwards spans to **Jaeger** (visible in
   `/search` as one connected waterfall) **and** pipes them into the
   **spanmetrics** connector.
4. spanmetrics emits `calls_total` + `duration` histogram on the **metrics
   pipeline**, exposed at `:8889`.
5. **Prometheus** scrapes `:8889` (RED) and each app `/metrics` (app-native),
   every 15s.
6. **Recording rules** normalize everything into `edtech:request_rate:job`,
   `edtech:error_rate:job`, `edtech:latency_p{50,99}:job`.
7. **Grafana** renders Overview / SLO / Service-detail from those series;
   **Jaeger Monitor** renders RED by querying Prometheus back.
8. If a rule like `HighErrorRate` fires, Prometheus pushes it to
   **Alertmanager**, which groups/routes it.

---

## 11. Quick reference — URLs & health checks

| Tool | URL | Use |
|------|-----|-----|
| Jaeger Search | http://localhost:16686/search | Find + open a trace |
| Jaeger Monitor | http://localhost:16686/monitor | RED from spans |
| Grafana | http://localhost:3001 (`admin`/`admin`) | Dashboards |
| Grafana SLO | http://localhost:3001/d/edtech-slo | Error-budget burn |
| Grafana Service Detail | http://localhost:3001/d/edtech-service-detail | Per-service p50/p99 |
| Prometheus targets | http://localhost:9090/targets | Scrape health |
| Prometheus rules | http://localhost:9090/rules | Recording/alert rules |
| Alertmanager | http://localhost:9093 | Alert routing |

**Verify the pipeline is healthy:**

```bash
# 1. All scrape targets UP?
open http://localhost:9090/targets      # otel-collector job must be UP for RED metrics

# 2. spanmetrics flowing?  (should return non-empty once traffic runs)
curl -s 'http://localhost:9090/api/v1/query?query=calls_total' | jq '.data.result | length'

# 3. Normalized SLIs present?
curl -s 'http://localhost:9090/api/v1/query?query=edtech:error_rate:job' | jq '.data.result'

# 4. Traces landing in Jaeger?
open http://localhost:16686/search      # pick service edtech-api-gateway → Find Traces
```

---

## 12. Why this matters for the Site24x7 comparison

| Question an operator asks | This OSS stack answers with… | Site24x7 equivalent |
|---------------------------|------------------------------|---------------------|
| "Which of 5 services is slow?" | **One Jaeger trace** — the fat span *is* the answer | Aggregate transaction charts; hunt per-monitor |
| "What's my error budget burn?" | `edtech-slo` dashboard, PromQL you own | Built-in SLA reports (less customizable) |
| "RED per service, no extra agents?" | **spanmetrics connector** derives it from traces | Requires APM agent per service |
| "Custom business metric (enrollments/min)?" | Add a recording rule + panel | Custom metric ingestion (plan-limited) |
| "Who owns the data / retention?" | You do — Prometheus + Jaeger storage config | Vendor cloud (managed retention) |

**Headline framing:** the same span becomes both a **trace** (root-cause in
Jaeger) and a **metric** (RED via spanmetrics → Prometheus → Grafana/Jaeger
Monitor), and normalized recording rules make five languages look like one
uniform SLI surface — all with configs you own, versioned in this repo.

---

## 13. File map (where to read the source of truth)

```
edtech/
├─ docker-compose.observability.yml     # overlay: collector, prom, grafana, jaeger, alertmanager + per-service OTLP env
├─ observability/
│  ├─ otel-collector-config.yml         # receivers/connectors/exporters/pipelines (spanmetrics!)
│  ├─ prometheus.yml                     # Compose scrape config (otel-collector:8889 + app /metrics)
│  ├─ recording-rules.yml               # normalized edtech:* SLIs (explicit per service)
│  └─ alertmanager.yml                   # minimal demo routing
├─ monitoring/
│  ├─ grafana/
│  │  ├─ provisioning/datasources/datasources.yaml   # Prometheus + Jaeger (stable uids)
│  │  ├─ provisioning/dashboards/dashboards.yaml     # file provider, folder EdTech, 30s reload
│  │  └─ dashboards/*.json               # overview, slo, service-detail, http-l7, app-runtime, infra-*
│  ├─ prometheus/{prometheus.yml,rules.yml}          # K8s/bare-metal scrape + alerts (node-exporter, cadvisor, alertmanager)
│  ├─ alertmanager/alertmanager.yml
│  ├─ loki/promtail-config.yaml          # log shipping (bare-metal)
│  └─ ebpf/{hubble-config.yaml,falco-rules.yaml}
├─ k8s/base/kustomization.yaml           # loads the SAME dashboard JSON via configMapGenerator
└─ demo/{RUNBOOK.md,TALKING-POINTS.md}   # fault-injection demo narration
```
