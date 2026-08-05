# Incident Response Guide

Updated: 2026-08-05

## Severity Guide

- `SEV1`: production unavailable, destructive action risk, or credential compromise
- `SEV2`: degraded monitoring, failed deploy, or broken backup path
- `SEV3`: non-critical UI or operator workflow issue

## First 10 Minutes

1. Freeze new deploys and dangerous Docker actions if the incident is active.
2. Open `Monitoring`, `Deploy`, `Backup`, and `Audit` in Telegram.
3. Identify the last successful deploy, backup, and alert state.
4. Decide between rollback, service restart, or manual host investigation.

## Common Playbooks

- Failed deployment
  Use `Rollback` from the `Deploy` screen and confirm the previous commit restored health.
- Backup path failure
  Check `BACKUP_DIRECTORY`, `pg_dump`, and free disk space before retrying.
- Unauthorized Telegram user
  Leave the account in `PENDING` or disable it from the `Users` screen.
- Docker action risk
  Turn off dangerous actions from the `Settings` screen immediately.

## Communications

- Capture the Telegram audit trail and target names involved.
- Record the failing commit hash or backup filename.
- Log whether the issue was mitigated by rollback, restart, or configuration change.
