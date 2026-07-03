# Kubernetes Monitoring Setup Guide

Complete step-by-step guide to deploy Site24x7 monitoring on the EdTech Kubernetes cluster.

---

## Prerequisites

- Kubernetes cluster running the EdTech platform (namespace: `edtech`)
- `kubectl` configured with admin access
- `kustomize` v4+ (or `kubectl apply -k`)
- Site24x7 account and device key (see [device-key-setup.md](device-key-setup.md))

---

## Step 1: Create the Monitoring Namespace

```bash
kubectl apply -f site24x7/kubernetes/namespace.yaml
```

Verify:
```bash
kubectl get namespace site24x7-monitoring
```

---

## Step 2: Create the Device Key Secret

**Never hardcode the device key.** Use kubectl to create it from the command line:

```bash
kubectl create secret generic site24x7-device-key \
  --from-literal=device-key=YOUR_DEVICE_KEY \
  --namespace=site24x7-monitoring
```

Verify (without revealing the key):
```bash
kubectl get secret site24x7-device-key -n site24x7-monitoring
```

---

## Step 3: Deploy RBAC Resources

The server agent needs ClusterRole permissions to read Kubernetes API resources:

```bash
kubectl apply -f site24x7/kubernetes/server-agent/site24x7-agent-serviceaccount.yaml
kubectl apply -f site24x7/kubernetes/server-agent/site24x7-agent-clusterrole.yaml
```

Verify:
```bash
kubectl get clusterrole site24x7-agent
kubectl get clusterrolebinding site24x7-agent
```

---

## Step 4: Apply the ConfigMap

```bash
kubectl apply -f site24x7/kubernetes/server-agent/site24x7-agent-configmap.yaml
```

---

## Step 5: Deploy the DaemonSet (Server Agent)

```bash
kubectl apply -f site24x7/kubernetes/server-agent/site24x7-agent-daemonset.yaml
```

The DaemonSet runs on **every node** including control-plane nodes (via tolerations).

Verify pods are running:
```bash
kubectl get pods -n site24x7-monitoring -l app=site24x7-server-agent -o wide
kubectl logs -n site24x7-monitoring -l app=site24x7-server-agent --tail=30
```

---

## Step 6: Apply APM ConfigMap

```bash
kubectl apply -f site24x7/kubernetes/apm-init-configmap.yaml
```

---

## Step 7: Apply Kubernetes Monitoring Config (Optional)

```bash
kubectl apply -f site24x7/kubernetes/kubernetes-monitoring/
```

---

## Step 8: Apply APM Patches to Application Deployments (Optional)

First, create the device key secret in the `edtech` namespace (for APM):

```bash
kubectl create secret generic site24x7-device-key \
  --from-literal=device-key=YOUR_DEVICE_KEY \
  --namespace=edtech
```

Then apply the strategic merge patches:

```bash
kubectl apply -k site24x7/kubernetes/patch-examples/
```

The patches inject `SITE24X7_APM_KEY` and other env vars into each deployment.
Pods will rolling-restart with APM enabled.

---

## Step 9: Verify in Site24x7 Portal

1. Log in to [Site24x7 Portal](https://www.site24x7.com)
2. Navigate to **Infrastructure** → **Kubernetes**
3. Look for `edtech-cluster` — it should appear within 2–5 minutes
4. Click the cluster to see node and pod metrics

For APM data:
1. Navigate to **APM** → **Applications**
2. Services appear after the first requests are processed

---

## Step 10: Configure Kubernetes Alerts in Portal

1. Go to **Monitors** → **Kubernetes** → your cluster
2. Click **Alert Settings**
3. Configure thresholds for:
   - Pod restarts (recommended: > 5 in 10 minutes)
   - Node pressure (DiskPressure, MemoryPressure)
   - Deployment unavailability
   - Resource limits exceeded

---

## Using the Makefile

```bash
# Install everything at once
make -f site24x7/Makefile k8s-install DEVICE_KEY=your_key

# Apply APM patches (optional)
make -f site24x7/Makefile k8s-apm-patch DEVICE_KEY=your_key

# Verify status
make -f site24x7/Makefile k8s-verify

# Remove everything
make -f site24x7/Makefile k8s-uninstall
```

---

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod -n site24x7-monitoring -l app=site24x7-server-agent
kubectl events -n site24x7-monitoring
```

### Agent not appearing in portal

```bash
# Check agent logs
kubectl logs -n site24x7-monitoring -l app=site24x7-server-agent --tail=100

# Verify secret exists
kubectl get secret site24x7-device-key -n site24x7-monitoring

# Check network connectivity from agent pod
kubectl exec -n site24x7-monitoring \
  $(kubectl get pod -n site24x7-monitoring -l app=site24x7-server-agent -o name | head -1) \
  -- curl -s https://apmcollector.site24x7.com/health
```

### APM patches not working

```bash
# Verify secret in edtech namespace
kubectl get secret site24x7-device-key -n edtech

# Check patch applied
kubectl get deployment api-gateway -n edtech -o jsonpath='{.spec.template.spec.containers[0].env}' | jq .
```
