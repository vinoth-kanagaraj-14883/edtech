# Site24x7 Kubernetes Monitoring

This directory contains configuration for Kubernetes cluster-level monitoring in Site24x7,
beyond the node-level metrics collected by the server agent DaemonSet.

## Files

| File | Purpose |
|------|---------|
| `site24x7-k8s-monitor-configmap.yaml` | Kubernetes monitoring plugin configuration |
| `site24x7-kube-state-integration.yaml` | Optional kube-state-metrics integration config |

## What This Monitors

- Deployment replica counts (desired vs. actual)
- Pod status and restart counts
- Node conditions (Ready, DiskPressure, MemoryPressure, etc.)
- HorizontalPodAutoscaler min/max/current replicas
- PersistentVolume capacity and status
- Kubernetes Events (for alert correlation)

## Setup

Apply these ConfigMaps after the server agent is deployed:

```bash
kubectl apply -f site24x7/kubernetes/kubernetes-monitoring/
```

The Site24x7 agent reads these ConfigMaps automatically when it runs in Kubernetes mode.

## Portal Configuration

After deploying the agent, in the Site24x7 portal:
1. Go to **Infrastructure** → **Kubernetes**
2. Your cluster `edtech-cluster` should appear within 5 minutes
3. Click the cluster to configure alert thresholds
4. Set up notification profiles for pod crash loops, node issues, etc.
