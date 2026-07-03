# Device Key Setup Guide

The Site24x7 Device Key is a unique identifier that authenticates your agents with the
Site24x7 cloud. This guide shows how to obtain it and use it securely.

---

## Step 1: Log In to Site24x7 Portal

1. Go to [https://www.site24x7.com](https://www.site24x7.com)
2. Click **Log In** (or **Start 30-day Free Trial** for a new account)
3. Enter your credentials

---

## Step 2: Navigate to Device Key

1. In the top navigation, click **Admin**
2. In the left sidebar, click **Inventory**
3. Click **Devices**
4. Your **Device Key** is displayed at the top of the page

It looks like: `us6ed876543210abcdefghijklmnopqrs`

---

## Step 3: Use the Device Key

### Option A: Ansible Vault (Recommended for Bare Metal)

```bash
# Encrypt the key
ansible-vault encrypt_string 'YOUR_DEVICE_KEY_HERE' \
  --name 'site24x7_device_key' \
  --vault-password-file ~/.vault_pass
```

Paste the encrypted output into `site24x7/bare-metal/ansible/group_vars/site24x7.yml`:

```yaml
site24x7_device_key: !vault |
  $ANSIBLE_VAULT;1.1;AES256
  62343433333236...
  (encrypted value)
```

Run the playbook with vault:

```bash
ansible-playbook -i inventory.ini site24x7.yml \
  --vault-password-file ~/.vault_pass
```

### Option B: Kubernetes Secret (Recommended for K8s)

```bash
kubectl create secret generic site24x7-device-key \
  --from-literal=device-key=YOUR_DEVICE_KEY_HERE \
  --namespace=site24x7-monitoring

# Also in edtech namespace (for APM patches)
kubectl create secret generic site24x7-device-key \
  --from-literal=device-key=YOUR_DEVICE_KEY_HERE \
  --namespace=edtech
```

### Option C: Environment Variable (Testing Only)

```bash
export DEVICE_KEY=YOUR_DEVICE_KEY_HERE
DEVICE_KEY=$DEVICE_KEY ./install-server-agent.sh
```

---

## Security Best Practices

1. **Never commit** the device key to git — it grants access to your Site24x7 account
2. The `.gitignore` in `site24x7/` excludes `*.key`, `.env.site24x7`, and `vault.yml`
3. Use **Ansible Vault** for bare-metal deployments
4. Use **Kubernetes Secrets** for K8s deployments
5. Rotate the device key periodically (Admin → Inventory → Devices → Regenerate)
6. Use separate Site24x7 accounts for dev and production environments

---

## Verifying the Key Works

After installation, check the Site24x7 portal:
- **Infrastructure → Servers** — should show your VMs within 2–5 minutes
- **Infrastructure → Kubernetes** — should show your cluster within 5 minutes
- **APM → Applications** — should show services after first requests

If nothing appears after 10 minutes:
1. Verify the key is correct (no extra spaces)
2. Check agent logs: `journalctl -u site24x7monagent -n 50`
3. Check outbound connectivity: `curl -v https://apmcollector.site24x7.com/health`

---

## Data Center Selection

Site24x7 has multiple data centers. If your team is in a specific region:

| Region | Portal URL | APM Endpoint |
|--------|-----------|-------------|
| US (default) | app.site24x7.com | apmcollector.site24x7.com |
| EU | app.site24x7.eu | apmcollector.site24x7.eu |
| IN | app.site24x7.in | apmcollector.site24x7.in |
| AU | app.site24x7.net.au | apmcollector.site24x7.net.au |
| CN | app.site24x7.cn | apmcollector.site24x7.cn |

Update `site24x7_apm_endpoint` in `group_vars/site24x7.yml` and the ConfigMaps accordingly.
