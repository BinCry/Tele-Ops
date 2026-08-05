# TeleOps Implementation Plan

Updated: 2026-08-05

## Target Outcome

Build TeleOps as a production-oriented NestJS Telegram operations bot with strict TypeScript, layered modules, PostgreSQL persistence, Redis-backed jobs, Docker integrations, and deployment/runbook documentation.

## Architecture Summary

- `Telegram transport` handles updates, callbacks, and menu rendering only.
- `Application services` own workflows such as dashboard, deploy, backup, and monitoring.
- `Policy layer` centralizes authentication, RBAC, rate limiting, and destructive-action confirmation.
- `Infrastructure gateways` encapsulate Docker, PostgreSQL backup, system metrics, queueing, and HTTP health checks.
- `Persistence` uses Prisma repositories and audit-first write flows.

## Milestones

1. `M0 Foundation`: NestJS strict baseline, env validation, logging, health skeleton, repo governance docs.
2. `M1 Infrastructure`: Prisma, PostgreSQL, Redis, Docker assets, CI baseline.
3. `M2 Telegram Shell`: Telegraf integration, navigation, callback ack, edit-or-send rendering.
4. `M3 Auth/RBAC`: owner bootstrap, user model, permission matrix, audit foundations, rate limits.
5. `M4 Dashboard/Server`: system metrics and server status screens.
6. `M5 Docker`: container list/detail/logs, confirmation flow, queue jobs, allowlist safety.
7. `M6 Deploy`: deployment targets, safe process runner, locking, health validation, rollback.
8. `M7 Database/Backup`: pg health, backup jobs, checksum, retention, download constraints.
9. `M8 Monitoring/Alerts`: health targets, metric retention, cooldown and resolved alerts.
10. `M9 Users/Settings`: user management flows, settings validation and UI.
11. `M10 Audit/Hardening`: audit screens, redaction, graceful shutdown, security tightening.
12. `M11 Docs/Deployment`: README, diagrams, threat model, deployment and incident runbooks.
13. `M12 Final Validation`: full verification matrix, Docker build/compose validation, readiness report.

## Delivery Rules

- Commit and push small milestone slices directly to `main`.
- Do not mark milestone tasks complete until code builds and relevant tests pass.
- Record assumptions in `DECISIONS.md`.
- Update `TASKS.md` and `CHANGELOG.md` after each milestone slice.
