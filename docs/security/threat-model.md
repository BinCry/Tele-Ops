# TeleOps Threat Model

Updated: 2026-08-05

## Protected Assets

- Telegram bot token and owner/admin access paths
- Deployment target definitions and repository working directories
- Docker mutation permissions
- Backup artifacts and database credentials
- Audit logs and action confirmation records

## Main Threats

- Unauthorized Telegram access
  Mitigations: persisted user model, `PENDING` onboarding, RBAC checks, and per-callback permission enforcement.
- Replay or theft of destructive-action confirmations
  Mitigations: single-use `ActionRequest` tokens, actor binding, TTL expiry, and audit trail.
- Over-broad Docker or deploy execution
  Mitigations: container allowlists, validated deployment targets, safe path validation, and dangerous actions disabled by default.
- Credential or secret leakage in logs and audit payloads
  Mitigations: `nestjs-pino` header redaction plus audit-payload sanitization for `token`, `password`, `secret`, `authorization`, `cookie`, `credential`, and API-key style fields.
- Silent service degradation after deploy or rollback
  Mitigations: optional linked health targets, persisted deployment history, and background monitoring plus alerts.

## Residual Risks

- Docker engine availability is still an operational dependency outside NestJS itself.
- Backup restore remains intentionally manual and disabled by default.
- Live Docker/Compose validation depends on a working Docker daemon in the host environment.

## Operator Recommendations

- Keep `DANGEROUS_ACTIONS_ENABLED=false` until container allowlists are populated.
- Restrict Telegram ownership/admin role grants to named operators only.
- Rotate `TELEGRAM_BOT_TOKEN` immediately if bot access is suspected to be compromised.
- Store production `.env` and YAML config files outside of ad-hoc chat or clipboard workflows.
