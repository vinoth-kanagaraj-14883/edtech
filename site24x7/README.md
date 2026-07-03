# Site24x7 Observability Integration

> **Isolated Layer**: This folder contains a completely standalone Site24x7 observability layer
> that **coexists with** the existing Prometheus + OpenTelemetry + Grafana + Jaeger stack.
> It does **not** replace, conflict with, or modify any existing monitoring infrastructure.

---

## Table of Contents

1. [What is This Folder?](#what-is-this-folder)
2. [Prerequisites](#prerequisites)
3. [Quick Start — Kubernetes](#quick-start--kubernetes)
4. [Quick Start — Bare Metal](#quick-start--bare-metal)
5. [Architecture](#architecture)
6. [Directory Structure](#directory-structure)
7. [Coexistence Note](#coexistence-note)
8. [Sub-READMEs](#sub-readmes)

---

## What is This Folder?

The `site24x7/` directory provides a **fully isolated, additive** observability layer on top of the existing EdTech platform monitoring stack. It deploys:

- **Site24x7 Server Agent** — monitors host-level metrics (CPU, memory, disk, network) on every Kubernetes node or bare-metal VM
- **Site24x7 APM Agents** — instruments application code in all 7 services across 5 languages (Go, Python, Java, Node.js, Ruby) for request tracing, error tracking, and performance profiling
- **Kubernetes Monitoring** — cluster-level visibility (pod status, node health, resource usage)
- **Alerting** — on-call schedules, escalation policies, and notification profiles in Site24x7

All configuration lives exclusively in this `site24x7/` folder. **No existing files are modified.**

---

## Prerequisites

- [Site24x7 account](https://www.site24x7.com) (free trial available)
- **Device Key** from Site24x7 portal → Admin → Inventory → Devices
  (see [docs/device-key-setup.md](docs/device-key-setup.md) for step-by-step instructions)
- For Kubernetes: `kubectl` configured, `kustomize` v4+, cluster access
- For bare metal: Ansible 2.12+, SSH access to all VMs

---

## Quick Start — Kubernetes

```bash
# 1. Create namespace and secret
kubectl create namespace site24x7-monitoring
kubectl create secret generic site24x7-device-key \
  --from-literal=device-key=YOUR_DEVICE_KEY \
  --namespace=site24x7-monitoring

# 2. Deploy Site24x7 server agent on every node
kubectl apply -f site24x7/kubernetes/server-agent/

# 3. (Optional) Apply APM patches to app deployments
kubectl apply -k site24x7/kubernetes/patch-examples/
```

Or use the Makefile:

```bash
make -f site24x7/Makefile k8s-install DEVICE_KEY=YOUR_DEVICE_KEY
make -f site24x7/Makefile k8s-apm-patch  # optional APM instrumentation
```

Check the Site24x7 portal in 2–3 minutes — your cluster should appear under Infrastructure → Kubernetes.

---

## Quick Start — Bare Metal

```bash
# 1. Copy and fill in the inventory
cp site24x7/bare-metal/inventory.example.ini inventory.ini
# Edit inventory.ini with your VM IPs

# 2. Run the Ansible playbook
ansible-playbook -i inventory.ini site24x7/bare-metal/ansible/site24x7.yml \
  -e "site24x7_device_key=YOUR_DEVICE_KEY"
```

Or using `ansible-vault` for the key:

```bash
ansible-vault encrypt_string 'YOUR_DEVICE_KEY' --name 'site24x7_device_key' \
  >> site24x7/bare-metal/ansible/group_vars/site24x7.yml
ansible-playbook -i inventory.ini site24x7/bare-metal/ansible/site24x7.yml --ask-vault-pass
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EdTech Platform                             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ api-gateway  │  │ user-service │  │course-service│             │
│  │   (Go/Gin)   │  │(Python/Fast) │  │(Java/Spring) │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                  │                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────┐│
│  │content-svc   │  │ quiz-service │  │notification  │  │frontend││
│  │(Node.js/TS)  │  │(Ruby/Sinatra)│  │  (Go/Fiber)  │  │(Next14)││
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └───┬────┘│
│         │                 │                  │               │      │
└─────────┼─────────────────┼──────────────────┼───────────────┼─────┘
          │    Site24x7 APM │Agents            │               │
          └────────┬────────┘                  │               │
                   │                           │               │
          ┌────────▼───────────────────────────▼───────────────▼──────┐
          │              Site24x7 APM Collector                        │
          │          (per-language SDK / OTel endpoint)                │
          └────────────────────────┬───────────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────┐
│                    K8s Nodes / Bare-Metal VMs                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │           Site24x7 Server Agent (DaemonSet / systemd)          │  │
│  │        CPU · Memory · Disk · Network · Process monitoring       │  │
│  └──────────────────────────────┬─────────────────────────────────┘  │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │     Site24x7 Cloud Portal    │
                    │   Dashboards · APM · Alerts  │
                    └─────────────┬──────────────-┘
                                  │ Alerting
                    ┌─────────────▼──────────────┐
                    │   PagerDuty / Email / Slack  │
                    └──────────────────────────────┘

─────────────────────── EXISTING STACK (UNTOUCHED) ─────────────────────────

  Services → OTel Collector → Prometheus → Grafana
                           └──────────→ Jaeger (traces)
                                      → Loki (logs)
```

---

## Directory Structure

```
site24x7/
├── README.md                          ← This file
├── Makefile                           ← Convenience targets
├── .gitignore                         ← Excludes *.key, vault.yml, .env.site24x7
├── kubernetes/
│   ├── README.md
│   ├── namespace.yaml
│   ├── apm-init-configmap.yaml
│   ├── apm-device-key-secret.yaml.example
│   ├── apm-agent/                     ← Language-specific APM snippets
│   │   ├── go/
│   │   ├── python/
│   │   ├── java/
│   │   ├── nodejs/
│   │   └── ruby/
│   ├── server-agent/                  ← DaemonSet + RBAC
│   ├── kubernetes-monitoring/         ← K8s cluster monitoring config
│   └── patch-examples/               ← Strategic merge patches (no original file edits)
├── bare-metal/
│   ├── README.md
│   ├── ansible/
│   │   ├── site24x7.yml              ← Master playbook (standalone)
│   │   ├── group_vars/site24x7.yml
│   │   └── roles/                    ← Per-language APM + server agent roles
│   ├── inventory.example.ini
│   └── scripts/                      ← Standalone shell scripts
├── dashboards/                        ← Site24x7 dashboard JSON exports
├── alerts/                            ← Alert profile JSON templates
└── docs/                              ← Detailed documentation
```

---

## Coexistence Note

This Site24x7 integration is designed to run **alongside** the existing observability stack:

| Tool | Purpose | Status |
|------|---------|--------|
| Prometheus + Grafana | Custom metrics, SLI/SLO dashboards | **Untouched** |
| OpenTelemetry Collector | Trace/metric pipeline | **Untouched** |
| Jaeger | Distributed tracing UI | **Untouched** |
| Loki + Promtail | Log aggregation | **Untouched** |
| **Site24x7** | **Server health, APM, alerting, on-call** | **New (this folder)** |

The Go services (`api-gateway`, `notification-service`) already use OpenTelemetry SDK.
Site24x7 can ingest OTel data directly — just point `OTEL_EXPORTER_OTLP_ENDPOINT` to the
Site24x7 OTel-compatible endpoint. **No application code changes required for Go services.**

---

## Sub-READMEs

- [kubernetes/README.md](kubernetes/README.md) — Kubernetes deployment guide
- [kubernetes/apm-agent/go/README.md](kubernetes/apm-agent/go/README.md) — Go APM setup
- [kubernetes/apm-agent/python/README.md](kubernetes/apm-agent/python/README.md) — Python APM setup
- [kubernetes/apm-agent/java/README.md](kubernetes/apm-agent/java/README.md) — Java APM setup
- [kubernetes/apm-agent/nodejs/README.md](kubernetes/apm-agent/nodejs/README.md) — Node.js APM setup
- [kubernetes/apm-agent/ruby/README.md](kubernetes/apm-agent/ruby/README.md) — Ruby APM setup
- [kubernetes/server-agent/README.md](kubernetes/server-agent/README.md) — Server agent DaemonSet
- [kubernetes/patch-examples/README.md](kubernetes/patch-examples/README.md) — Patch strategy
- [bare-metal/README.md](bare-metal/README.md) — Bare-metal deployment guide
- [docs/architecture.md](docs/architecture.md) — Dual observability architecture
- [docs/apm-languages.md](docs/apm-languages.md) — Language-by-language APM guide
- [docs/kubernetes-monitoring.md](docs/kubernetes-monitoring.md) — Full K8s setup guide
- [docs/bare-metal-monitoring.md](docs/bare-metal-monitoring.md) — Full bare-metal guide
- [docs/device-key-setup.md](docs/device-key-setup.md) — Getting your device key
- [docs/comparison.md](docs/comparison.md) — Site24x7 vs Prometheus/Grafana
- [docs/troubleshooting.md](docs/troubleshooting.md) — Troubleshooting guide
