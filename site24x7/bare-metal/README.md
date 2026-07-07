# Site24x7 Bare-Metal Deployment

This directory contains everything needed to deploy Site24x7 server monitoring agents
and APM agents on the EdTech bare-metal VMs (Ubuntu 22.04, one service per VM).

## Structure

```
bare-metal/
├── ansible/
│   ├── site24x7.yml              ← Master playbook (standalone, independent)
│   ├── group_vars/site24x7.yml   ← Site24x7 vars (device key placeholder, versions)
│   └── roles/
│       ├── site24x7-server-agent/  ← Install server monitoring agent on every VM
│       ├── site24x7-apm-go/        ← APM config for api-gateway, notification-service
│       ├── site24x7-apm-python/    ← APM config for user-service
│       ├── site24x7-apm-java/      ← APM config for course-service
│       ├── site24x7-apm-nodejs/    ← APM config for content-service, frontend
│       └── site24x7-apm-ruby/      ← APM config for quiz-service
├── inventory.example.ini           ← Mirrors bare-metal inventory + [site24x7:children]
└── scripts/                        ← Standalone shell scripts (no Ansible required)
    ├── install-server-agent.sh
    ├── install-apm-go.sh
    ├── install-apm-python.sh
    ├── install-apm-java.sh
    ├── install-apm-nodejs.sh
    ├── install-apm-ruby.sh
    └── verify-agents.sh
```

## Quick Start

```bash
# 1. Copy and edit the inventory
cp inventory.example.ini /tmp/site24x7-inventory.ini
vim /tmp/site24x7-inventory.ini  # Fill in your VM IPs

# 2. Run the full playbook
ansible-playbook -i /tmp/site24x7-inventory.ini ansible/site24x7.yml \
  -e "site24x7_device_key=YOUR_DEVICE_KEY"

# 3. Verify agents
./scripts/verify-agents.sh /tmp/site24x7-inventory.ini
```

## Security — Device Key

Never put your device key in plaintext files. Use Ansible Vault:

```bash
# Encrypt the key
ansible-vault encrypt_string 'YOUR_DEVICE_KEY' --name 'site24x7_device_key'
# Paste the output into ansible/group_vars/site24x7.yml

# Run playbook with vault
ansible-playbook -i inventory.ini ansible/site24x7.yml --ask-vault-pass
```

## VM Layout

| VM / Host Group | Service | APM Language |
|----------------|---------|-------------|
| `api_gateway` | api-gateway (Go/Gin :8080) | Go (OTel) |
| `user_service` | user-service (Python/FastAPI :8001) | Python |
| `course_service` | course-service (Java/Spring :8002) | Java agent |
| `content_service` | content-service (Node.js :8003) | Node.js |
| `quiz_service` | quiz-service (Ruby/Sinatra :8004) | Ruby |
| `notification_service` | notification-service (Go/Fiber :8005) | Go (OTel) |
| `frontend_host` | frontend (Next.js :3000) | Node.js |

The `site24x7-server-agent` role runs on **all** VMs.
