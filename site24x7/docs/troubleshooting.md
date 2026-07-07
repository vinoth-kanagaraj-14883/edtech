# Troubleshooting Guide

Common issues and solutions for the Site24x7 observability integration.

---

## Server Agent Issues

### Agent not appearing in Site24x7 portal

**Symptoms**: Server monitoring installed but VM doesn't appear in Infrastructure → Servers.

**Checklist**:
1. Verify the device key is correct (no trailing spaces):
   ```bash
   /opt/site24x7monagent/bin/monagent config | grep device_key
   ```

2. Check agent service status:
   ```bash
   systemctl status site24x7monagent
   journalctl -u site24x7monagent -n 100 --no-pager
   ```

3. Test outbound connectivity:
   ```bash
   curl -v https://staticdownloads.site24x7.com/health
   curl -v https://apmcollector.site24x7.com/health
   ```

4. Check firewall rules:
   ```bash
   # Ensure outbound HTTPS (443) is allowed
   ufw status
   ```

5. Wait 3–5 minutes after installation — initial registration takes time.

---

### Agent installed but showing as offline

```bash
# Restart the agent
systemctl restart site24x7monagent

# Check disk space (agent needs space for logs)
df -h /opt/site24x7monagent/

# Check proxy configuration
grep -i proxy /opt/site24x7monagent/conf/agent.cfg
```

---

## Kubernetes Issues

### DaemonSet pods in Pending state

```bash
kubectl describe pod -n site24x7-monitoring \
  $(kubectl get pod -n site24x7-monitoring -o name | head -1)
```

Common causes:
- **Resource pressure**: Nodes don't have enough CPU/memory for the agent
  - Solution: Reduce resource requests in the DaemonSet or add nodes
- **Secret missing**: `site24x7-device-key` Secret not found
  ```bash
  kubectl get secret site24x7-device-key -n site24x7-monitoring
  ```

---

### APM patches not applying

```bash
# Verify kustomize can process the overlay
kubectl kustomize site24x7/kubernetes/patch-examples/

# Check if target deployments exist
kubectl get deployment -n edtech

# Check if APM secret exists in edtech namespace
kubectl get secret site24x7-device-key -n edtech
```

If the deployment names don't match exactly, update `kustomization.yaml`:
```yaml
patches:
  - path: api-gateway-patch.yaml
    target:
      name: your-actual-deployment-name  # ← update this
```

---

### APM env vars injected but no data in portal

1. Check pod has restarted with new env vars:
   ```bash
   kubectl exec -n edtech \
     $(kubectl get pod -n edtech -l app=api-gateway -o name | head -1) \
     -- env | grep SITE24X7
   ```

2. For Go services — verify OTel exporter endpoint:
   ```bash
   kubectl exec -n edtech ... -- env | grep SITE24X7_OTLP_ENDPOINT
   ```

3. For Java — verify JAVA_TOOL_OPTIONS and agent JAR:
   ```bash
   kubectl exec -n edtech ... -- ls -la /opt/site24x7/
   kubectl exec -n edtech ... -- env | grep JAVA_TOOL_OPTIONS
   ```

4. Check service logs for APM initialization messages:
   ```bash
   kubectl logs -n edtech -l app=user-service --tail=50 | grep -i site24x7
   ```

---

## APM Issues by Language

### Python: `ImportError: No module named 'site24x7'`

```bash
# Verify installation
pip3 show site24x7-apm

# If missing, install
pip3 install site24x7-apm

# In a venv:
/path/to/venv/bin/pip install site24x7-apm
```

### Node.js: `Error: Cannot find module 'site24x7-apm'`

```bash
# Global installation
npm list -g site24x7-apm
npm install -g site24x7-apm

# Local installation (in service directory)
npm install site24x7-apm
```

### Ruby: `LoadError: cannot load such file -- site24x7`

```bash
# Verify gem
gem list site24x7
gem install site24x7

# If using bundler
bundle exec gem list site24x7
```

### Java: `Unable to open JAR file: /opt/site24x7/apm-agent.jar`

```bash
# Re-download the agent
curl -fsSL -o /opt/site24x7/apm-agent.jar \
  https://staticdownloads.site24x7.com/APM/Java/site24x7-java-agent.jar

# Verify
ls -lh /opt/site24x7/apm-agent.jar
```

---

## Ansible Playbook Issues

### `Failed to connect to the host via ssh`

```bash
# Test SSH connectivity
ssh -i ~/.ssh/edtech_key ubuntu@10.0.1.10 "echo connected"

# Update inventory with correct key path
ansible_ssh_private_key_file=/path/to/correct/key.pem
```

### `Wrong decryption password` for vault

```bash
# Re-create vault password file
echo 'your_vault_password' > ~/.vault_pass
chmod 600 ~/.vault_pass

ansible-playbook ... --vault-password-file ~/.vault_pass
```

---

## Getting Help

- [Site24x7 Documentation](https://www.site24x7.com/help/)
- [Site24x7 Community Forums](https://community.site24x7.com/)
- [Site24x7 Support](https://www.site24x7.com/contact.html)
- Check agent logs: `journalctl -u site24x7monagent -n 200 --no-pager`
- Enable debug logging: Set `SITE24X7_LOG_LEVEL=debug` in environment
