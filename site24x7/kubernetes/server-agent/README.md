# Site24x7 Server Agent — Kubernetes DaemonSet

This directory deploys the Site24x7 server monitoring agent as a **DaemonSet**, ensuring
it runs on every node in the cluster (including control-plane nodes via tolerations).

## Files

| File | Purpose |
|------|---------|
| `site24x7-agent-daemonset.yaml` | DaemonSet spec — runs the agent on every K8s node |
| `site24x7-agent-configmap.yaml` | Agent configuration (cluster name, polling interval) |
| `site24x7-agent-clusterrole.yaml` | ClusterRole + ClusterRoleBinding for K8s API access |
| `site24x7-agent-serviceaccount.yaml` | ServiceAccount for the agent pods |
| `site24x7-agent-secret.yaml.example` | Template for the device key Secret (never commit the real one) |

## What the Agent Monitors

- Node CPU, memory, disk I/O, network throughput
- Running pods and container resource usage (via cAdvisor)
- Kubernetes events (pod restarts, OOMKilled, etc.)
- Process-level metrics on each node

## Deployment

```bash
# Create namespace (if not already created)
kubectl apply -f ../namespace.yaml

# Create device key secret
kubectl create secret generic site24x7-device-key \
  --from-literal=device-key=YOUR_DEVICE_KEY \
  --namespace=site24x7-monitoring

# Apply all server-agent manifests
kubectl apply -f .
```

## Verify

```bash
kubectl get daemonset site24x7-server-agent -n site24x7-monitoring
kubectl get pods -n site24x7-monitoring -l app=site24x7-server-agent -o wide
kubectl logs -n site24x7-monitoring -l app=site24x7-server-agent --tail=50
```

The agent should appear in the Site24x7 portal under Infrastructure → Servers within 2–3 minutes.
