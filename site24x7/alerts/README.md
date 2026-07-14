# Site24x7 Alert Profiles

This directory contains JSON templates for Site24x7 alert profiles, on-call schedules,
and notification profiles for the EdTech platform.

## Files

| File | Purpose |
|------|---------|
| `alert-profiles.json` | Alert threshold definitions (APM, server, K8s) |
| `on-call-schedule.json` | On-call rotation and escalation policy template |
| `notification-profiles.json` | Notification channels (PagerDuty, Slack, email) |

## How to Use

These JSON files are **reference templates**. The Site24x7 portal does not directly
import arbitrary JSON — use them as a guide when configuring alerts in the portal UI.

### Creating Alert Profiles

1. Go to **Site24x7 Portal** → **Admin** → **Alert Settings** → **Alert Profiles**
2. Create a new profile
3. Use the thresholds from `alert-profiles.json` as guidance

### Creating Notification Profiles

1. Go to **Site24x7 Portal** → **Admin** → **Alert Settings** → **Notification Profiles**
2. Configure channels (Slack, PagerDuty, email)
3. Replace `REPLACE_WITH_*` placeholders with your actual webhook URLs and keys

### Creating On-Call Schedules

1. Go to **Site24x7 Portal** → **Admin** → **On-Call Schedules**
2. Create a new schedule matching the structure in `on-call-schedule.json`
3. Add your team members and rotation settings

## Recommended Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response time | > 1000ms | > 2000ms |
| Error rate | > 1% | > 5% |
| CPU utilization | > 75% | > 90% |
| Memory utilization | > 80% | > 95% |
| Disk utilization | > 75% | > 90% |
| Pod restarts | — | > 5 in 10min |
| Apdex score | < 0.85 | < 0.70 |
