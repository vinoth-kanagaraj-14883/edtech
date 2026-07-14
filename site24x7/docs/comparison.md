# Site24x7 vs Prometheus/Grafana — When to Use Each

Both observability stacks are deployed on the EdTech platform simultaneously.
This guide helps you decide which one to reach for in different scenarios.

---

## Quick Reference

| Scenario | Use This |
|----------|----------|
| Service is down at 3am, need to page someone | **Site24x7** |
| Investigating a slow endpoint | **Jaeger + Grafana** |
| Checking SLO error budget burn rate | **Grafana** |
| VM running out of disk space | **Site24x7** |
| Which SQL query is the bottleneck? | **Site24x7 APM** |
| Custom business metric (e.g., enrollments/min) | **Prometheus + Grafana** |
| Kubernetes pod crash loop | **Site24x7 + Grafana** |
| Browser-side performance (frontend) | **Site24x7 RUM** |
| P99 latency over 30 days | **Grafana** |
| Uptime SLA report for management | **Site24x7** |
| Trace a request across 5 services | **Jaeger** |
| On-call schedule management | **Site24x7** |

---

## Detailed Comparison

### Alerting and On-Call

| Feature | Site24x7 | Prometheus + Alertmanager |
|---------|----------|--------------------------|
| On-call schedules | ✅ Built-in | ❌ Need PagerDuty/OpsGenie |
| Escalation policies | ✅ Built-in | ❌ External tool |
| SMS/Phone alerts | ✅ Built-in | ❌ External tool |
| Alert suppression | ✅ | ✅ |
| Maintenance windows | ✅ | ✅ (inhibit rules) |
| Historical alert reports | ✅ | ⚠️ Limited |

**Winner for alerting/on-call: Site24x7**

---

### APM (Application Performance Monitoring)

| Feature | Site24x7 APM | Jaeger + OTel |
|---------|-------------|--------------|
| Transaction traces | ✅ | ✅ |
| Database query analysis | ✅ Automatic | ⚠️ Requires instrumentation |
| Error tracking | ✅ | ⚠️ Custom spans needed |
| Apdex score | ✅ | ❌ Manual calculation |
| Flame graphs | ✅ | ✅ |
| Code-level profiling | ✅ (Java, Python) | ❌ |
| Custom span attributes | ⚠️ Limited | ✅ Full control |
| Long-term trace storage | ✅ Cloud | ⚠️ Depends on Jaeger config |

**Winner for deep APM: Site24x7 for operational use, Jaeger for engineering debugging**

---

### Infrastructure Monitoring

| Feature | Site24x7 | Prometheus + Node Exporter |
|---------|----------|--------------------------|
| Host CPU/memory/disk | ✅ | ✅ |
| Network I/O | ✅ | ✅ |
| Process monitoring | ✅ | ⚠️ Process exporter |
| Agent-based (push) | ✅ | ❌ Pull-based |
| Zero config needed | ✅ | ❌ Requires setup |
| Custom metrics | ⚠️ Limited | ✅ Full PromQL |
| Long-term retention | ✅ Cloud (13 months) | ⚠️ Depends on Prometheus config |
| Cost at scale | 💲 Per-monitor | 💲 Infrastructure cost |

**Winner for infra ops: Site24x7 (simpler), Prometheus (more flexible)**

---

### Kubernetes Monitoring

| Feature | Site24x7 | Prometheus + kube-state-metrics |
|---------|----------|-------------------------------|
| Node health | ✅ | ✅ |
| Pod status/restarts | ✅ | ✅ |
| HPA scaling events | ✅ | ✅ |
| Namespace resource quotas | ✅ | ✅ |
| Cost attribution | ✅ | ⚠️ Needs kubecost |
| Custom K8s metrics | ❌ | ✅ Custom Prometheus rules |
| SLO tracking | ❌ | ✅ (with recording rules) |

**Winner for K8s: Both are strong; Site24x7 for ops, Prometheus for SLOs**

---

### Dashboards and Visualization

| Feature | Site24x7 | Grafana |
|---------|----------|---------|
| Pre-built dashboards | ✅ Many | ✅ Many (community) |
| Custom panels | ⚠️ Limited | ✅ Extensive |
| PromQL queries | ❌ | ✅ |
| SQL-like queries | ❌ | ✅ (Loki, Tempo) |
| Embedded dashboards | ⚠️ Limited | ✅ (iframe support) |
| Mobile app | ✅ | ⚠️ Limited |

**Winner for dashboards: Grafana (for engineering), Site24x7 (for operations)**

---

## Summary: The Dual-Stack Philosophy

```
          Engineering Team            Operations Team
               │                            │
               ▼                            ▼
      Grafana + Jaeger              Site24x7 Portal
    (deep debugging, SLOs)       (server health, on-call,
                                   executive reports)
               │                            │
               └────────────┬───────────────┘
                            │
                    Both pull from the
                    same application services
```

The two stacks are complementary:
- **Site24x7** is optimized for **fast incident detection** and **human on-call management**
- **Prometheus + Grafana** is optimized for **deep analysis**, **custom metrics**, and **SLO tracking**
- Running both means you get the best of both worlds with minimal duplication
