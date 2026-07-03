# Bare Metal VM Deployment — One Service Per VM

This directory provides a complete Ansible-driven deployment for Ubuntu 22.04 LTS with one service per VM, systemd process management, firewalling, logging, and observability agents.

## 1) Architecture diagram (example IP layout)

```text
                                  ┌──────────────────────────┐
                                  │ frontend VM              │
                                  │ 192.168.1.16 :80/:443    │
                                  │ Next.js (:3000 internal) │
                                  └─────────────┬────────────┘
                                                │
                                                ▼
                                  ┌──────────────────────────┐
                                  │ api-gateway VM           │
                                  │ 192.168.1.10 :8080       │
                                  └─┬─────────┬─────────┬────┘
                                    │         │         │
                                    ▼         ▼         ▼
                 ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
                 │ user-service VM      │ │ course-service VM    │ │ content-service VM   │
                 │ 192.168.1.11 :8001   │ │ 192.168.1.12 :8002   │ │ 192.168.1.13 :8003   │
                 └──────────┬───────────┘ └──────────┬───────────┘ └──────────┬───────────┘
                            │                        │                         │
                            └─────────────┬──────────┴────────────┬────────────┘
                                          ▼                       ▼
                                ┌──────────────────┐      ┌──────────────────┐
                                │ PostgreSQL VM     │      │ MySQL VM         │
                                │ 192.168.1.20:5432 │      │ 192.168.1.21:3306│
                                └──────────────────┘      └──────────────────┘

            ┌──────────────────────┐          ┌──────────────────────┐          ┌──────────────────────┐
            │ quiz-service VM      │          │ notification-service │          │ redis VM              │
            │ 192.168.1.14 :8004   │◄────────►│ VM 192.168.1.15:8005 │◄────────►│ 192.168.1.22 :6379    │
            └──────────────────────┘          └──────────────────────┘          └──────────────────────┘

       ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
       │ prometheus VM    │  │ grafana VM       │  │ jaeger VM        │  │ otel-collector VM│  │ loki VM          │
       │ 192.168.1.30:9090│  │ 192.168.1.31:3000│  │ 192.168.1.32:16686│ │ 192.168.1.33:4317│ │ 192.168.1.34:3100│
       └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

## 2) Prerequisites

- Ubuntu 22.04 LTS on every target VM
- Control node with Ansible 2.15+ and Python 3
- SSH key-based auth to every VM
- `community.general`, `community.mysql`, and `community.postgresql` Ansible collections installed
- Optional: Terraform 1.5+ for test VM provisioning

## 3) VM sizing recommendations

| VM Role             | Min CPU | Min RAM | Min Disk |
|---------------------|---------|---------|----------|
| api-gateway         | 2 vCPU  | 2 GB    | 20 GB    |
| user-service        | 2 vCPU  | 4 GB    | 20 GB    |
| course-service      | 4 vCPU  | 8 GB    | 20 GB    |
| content-service     | 2 vCPU  | 4 GB    | 20 GB    |
| quiz-service        | 2 vCPU  | 2 GB    | 20 GB    |
| notification-service| 2 vCPU  | 2 GB    | 20 GB    |
| frontend            | 2 vCPU  | 4 GB    | 20 GB    |
| postgresql          | 4 vCPU  | 8 GB    | 100 GB   |
| mysql               | 4 vCPU  | 8 GB    | 100 GB   |
| redis               | 2 vCPU  | 4 GB    | 20 GB    |
| prometheus          | 4 vCPU  | 8 GB    | 200 GB   |
| grafana             | 2 vCPU  | 4 GB    | 20 GB    |
| jaeger              | 4 vCPU  | 8 GB    | 100 GB   |
| otel-collector      | 2 vCPU  | 4 GB    | 20 GB    |
| loki                | 4 vCPU  | 8 GB    | 200 GB   |

## 4) Network/firewall overview

- Public ingress: frontend `80/443`, api-gateway `8080`, Grafana `3000`, Jaeger `16686`, Prometheus `9090`
- Service ingress:
  - api-gateway -> user/course/content/quiz/notification (`8001-8005`)
  - services -> DB/Redis (`5432`,`3306`,`6379`)
- Observability:
  - Prometheus scrapes every VM `:9100` (node_exporter)
  - Prometheus scrapes DB exporters (`9187`, `9104`, `9121`)
  - Promtail pushes logs to Loki `:3100`
  - Apps export telemetry to OTel Collector `:4317`

## 5) Step-by-step deployment

1. **Provision VMs**
   - Manually, or use `terraform/` examples.
2. **Create inventory.ini**
   - `cp inventory.example.ini inventory.ini` then edit, or run `./scripts/generate-inventory.sh`.
3. **Set SSH keys**
   - Ensure control node key can SSH to all inventory hosts.
4. **Bootstrap each VM**
   - Run `sudo ./scripts/bootstrap-vm.sh` on each VM, or use Ansible raw bootstrap.
5. **Deploy all roles**
   - `make deploy` (runs `ansible/site.yml` in required role order).
6. **Verify health**
   - `./scripts/health-check-vms.sh`
7. **Open URLs**
   - App (frontend): `http://<frontend-ip>`
   - Grafana: `http://<grafana-ip>:3000`
   - Jaeger: `http://<jaeger-ip>:16686`
   - Prometheus: `http://<prometheus-ip>:9090`

## 6) Updating a service

- Single target deploy:

```bash
make deploy-service SERVICE=user_service
# or
./scripts/deploy-service.sh user_service
```

## 7) Rolling updates

```bash
./scripts/rolling-update.sh user_service
```

This runs update-tagged tasks for one service at a time and then health checks.

## 8) Backup and restore

```bash
# backup
./scripts/backup-databases.sh /var/backups/edtech

# restore
./scripts/restore-databases.sh /path/postgres.sql /path/mysql.sql
```

For remote backups, sync resulting files to S3/object storage using your preferred CLI.

## 9) Troubleshooting

- **systemd service fails**
  - `systemctl status <service> -l`
  - `journalctl -u <service> -n 200 --no-pager`
- **Port conflict**
  - `ss -tlnp | grep <port>`
- **DB connection errors**
  - validate `.env` in `/opt/edtech/<service>/.env`
  - validate firewall and DB grants
- **Prometheus target down**
  - verify `node-exporter` and app metrics endpoints
- **Promtail not shipping logs**
  - `journalctl -u promtail -n 100`
  - verify Loki URL in `ansible/group_vars/all.yml`

## 10) Observability on bare metal

- `node-exporter` runs on every VM and exposes host-level infra metrics on `:9100`.
- `promtail` runs on every VM and ships:
  - `/var/log/edtech/*.log` labeled by `job=<service>` and host
  - `/var/log/syslog` labeled by `job=syslog`
- `otel-collector` centralizes traces/metrics/logs from services.
- Prometheus scrapes app metrics + node metrics + DB exporters.
- Grafana uses provisioned Prometheus/Jaeger/Loki data sources.

## Secrets management (Ansible Vault)

- Copy `ansible/group_vars/vault.yml.example` to `ansible/group_vars/vault.yml`
- Encrypt it:

```bash
ansible-vault encrypt ansible/group_vars/vault.yml
```

- Run deploy with vault password when needed.
