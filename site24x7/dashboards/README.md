# Site24x7 Dashboards

This directory contains Site24x7 dashboard JSON template exports for the EdTech platform.

## Dashboards

| File | Purpose |
|------|---------|
| `site24x7-apm-overview.json` | APM metrics for all 7 services (response time, throughput, error rate) |
| `site24x7-k8s-overview.json` | Kubernetes cluster health (nodes, pods, deployments, events) |
| `site24x7-infra-overview.json` | Bare-metal VM health (CPU, memory, disk, network, processes) |

## How to Import

1. Log into [Site24x7 Portal](https://www.site24x7.com)
2. Go to **Reports** → **Dashboards**
3. Click **Import Dashboard**
4. Upload the JSON file
5. The dashboard will appear in your dashboard list

## Customization

These templates use placeholder service names (`edtech-api-gateway`, etc.).
If your service names differ, update the `"services"` arrays in the JSON
to match the names shown in **Site24x7 → APM → Applications**.
