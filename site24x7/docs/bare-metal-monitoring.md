# Bare-Metal Monitoring Setup Guide

Complete step-by-step guide to deploy Site24x7 monitoring on EdTech bare-metal VMs.

---

## Prerequisites

- Ubuntu 22.04 VMs (one per service)
- SSH access to all VMs (key-based auth)
- Ansible 2.12+ installed on your control machine
- Site24x7 account and device key (see [device-key-setup.md](device-key-setup.md))

---

## Step 1: Get Your Device Key

See [device-key-setup.md](device-key-setup.md) for instructions.

---

## Step 2: Set Up Inventory

```bash
cp site24x7/bare-metal/inventory.example.ini /tmp/site24x7-inventory.ini
```

Edit the inventory file with your VM IP addresses:

```ini
[api_gateway]
api-gateway-vm ansible_host=10.0.1.10 ansible_user=ubuntu

[user_service]
user-service-vm ansible_host=10.0.1.11 ansible_user=ubuntu

# ... fill in all VMs
```

---

## Step 3: Secure the Device Key with Ansible Vault

**Option A: Ansible Vault (recommended)**

```bash
ansible-vault encrypt_string 'YOUR_DEVICE_KEY' \
  --name 'site24x7_device_key' \
  --vault-password-file ~/.vault_pass

# Paste the output into:
# site24x7/bare-metal/ansible/group_vars/site24x7.yml
# replacing: site24x7_device_key: "REPLACE_WITH_YOUR_DEVICE_KEY"
```

**Option B: Pass on command line (for testing only)**

```bash
ansible-playbook ... -e "site24x7_device_key=YOUR_KEY"
```

---

## Step 4: Run the Ansible Playbook

```bash
ansible-playbook \
  -i /tmp/site24x7-inventory.ini \
  site24x7/bare-metal/ansible/site24x7.yml \
  --ask-vault-pass  # omit if using -e flag
```

This runs in order:
1. Installs Site24x7 server agent on **all** VMs
2. Configures APM for Go services (api-gateway, notification-service)
3. Configures APM for Python (user-service)
4. Configures APM for Java (course-service)
5. Configures APM for Node.js (content-service, frontend)
6. Configures APM for Ruby (quiz-service)

---

## Step 5: Or Use Standalone Shell Scripts (No Ansible)

For a single VM, use the standalone scripts:

```bash
# Install server agent on one VM (run on the target VM)
DEVICE_KEY=your_key ./site24x7/bare-metal/scripts/install-server-agent.sh

# Configure APM (run on the target VM, matching the language)
DEVICE_KEY=your_key SERVICE_NAME=edtech-api-gateway \
  ./site24x7/bare-metal/scripts/install-apm-go.sh

DEVICE_KEY=your_key SERVICE_NAME=edtech-user-service \
  ./site24x7/bare-metal/scripts/install-apm-python.sh

DEVICE_KEY=your_key SERVICE_NAME=edtech-course-service \
  ./site24x7/bare-metal/scripts/install-apm-java.sh

DEVICE_KEY=your_key SERVICE_NAME=edtech-content-service \
  ./site24x7/bare-metal/scripts/install-apm-nodejs.sh

DEVICE_KEY=your_key SERVICE_NAME=edtech-quiz-service \
  ./site24x7/bare-metal/scripts/install-apm-ruby.sh
```

---

## Step 6: Verify Agents

```bash
./site24x7/bare-metal/scripts/verify-agents.sh /tmp/site24x7-inventory.ini
```

Expected output:
```
HOST                                SERVER AGENT    APM ENV FILE   STATUS
api-gateway-vm (10.0.1.10)         ✓ running       ✓ present      OK
user-service-vm (10.0.1.11)        ✓ running       ✓ present      OK
course-service-vm (10.0.1.12)      ✓ running       ✓ present      OK
content-service-vm (10.0.1.13)     ✓ running       ✓ present      OK
quiz-service-vm (10.0.1.14)        ✓ running       ✓ present      OK
notification-service-vm (10.0.1.15) ✓ running      ✓ present      OK
frontend-vm (10.0.1.16)            ✓ running       ✓ present      OK
```

---

## Step 7: Configure Portal Monitors

After agents appear in the portal (2–5 minutes):

1. **Process Monitors**: Go to **Monitors** → **Process** → Add monitors for key processes:
   - `api-gateway` on api-gateway-vm
   - `uvicorn` on user-service-vm
   - `java` on course-service-vm
   - `node` on content-service-vm
   - `ruby` on quiz-service-vm

2. **URL Monitors**: Add health endpoint checks:
   - `http://10.0.1.10:8080/health` (api-gateway)
   - `http://10.0.1.11:8001/health` (user-service)
   - `http://10.0.1.12:8002/actuator/health` (course-service)
   - `http://10.0.1.13:8003/health` (content-service)
   - `http://10.0.1.14:8004/health` (quiz-service)
   - `http://10.0.1.15:8005/health` (notification-service)

---

## Step 8: Set Up Alert Escalations

1. Go to **Admin** → **Alert Settings** → **Alert Profiles**
2. Use templates from [../alerts/alert-profiles.json](../alerts/alert-profiles.json)
3. Configure on-call schedule (see [../alerts/on-call-schedule.json](../alerts/on-call-schedule.json))
4. Link alert profiles to notification profiles (PagerDuty, Slack)

---

## Using the Makefile

```bash
# Install on all VMs
make -f site24x7/Makefile bare-metal-install \
  DEVICE_KEY=your_key \
  INVENTORY=/tmp/site24x7-inventory.ini

# Verify all agents
make -f site24x7/Makefile bare-metal-verify \
  INVENTORY=/tmp/site24x7-inventory.ini
```
