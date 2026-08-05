# Changelog

## Unreleased

### Added

- Initialized TeleOps NestJS workspace.
- Added milestone planning, task tracking, and architecture decision records.
- Replaced demo Nest app with validated configuration, structured logging, and `/health` endpoint coverage.
- Added baseline environment examples and config stubs for future deploy, monitoring, and alert milestones.
- Added Prisma schema, seed script, database module, and initial SQL migration for core TeleOps entities.
- Added Dockerfile, development/production Compose files, shell helper scripts, and GitHub Actions CI foundation.
- Added Telegram polling shell with Vietnamese home menu, callback acknowledgement, and edit-or-send rendering fallback.
- Added unit coverage for Telegram navigation and renderer behavior without calling the real Telegram API.
- Added persistent Telegram auth, owner bootstrap, RBAC permission matrix, audit logging foundation, and per-user Telegram rate limiting.
- Added role-aware home menu rendering so viewers/operators/admins see only the controls they are allowed to access.
- Added server metrics gateway and dashboard aggregation service backed by `systeminformation`.
- Added live Telegram screens for `Dashboard` and `Server` with CPU, RAM, disk, hostname, and uptime data.
- Added Docker gateway/service groundwork with allowlist-aware container listing and recent log retrieval.
- Added Telegram Docker and Logs screens with graceful fallback when the Docker daemon is unavailable.
- Added backup module groundwork with database reachability checks, backup environment probes, and Telegram screens for `Database` and `Backup`.
- Added read-only Telegram screens for `Users`, `Settings`, and `Audit`.
- Fixed Telegram callback authorization so backend permission checks run before all implemented feature screens render.
- Added persisted `ActionRequest` confirmation flow for Docker start/stop/restart actions with token-based confirm/cancel handling.
- Added backend-only `docker.manage` permission and allowlist-aware Docker action buttons in the Telegram Docker screen.
- Added `PostgresBackupGateway` plus backup execution orchestration with persistent records, SHA-256 checksum generation, and retention cleanup.
- Added Telegram backup creation confirmation flow and post-run success rendering on the `Backup` screen.
- Added `DeployTargetsService` with YAML parsing/validation and a live Telegram `Deploy` overview screen for configured targets.
- Added `DeploymentService` and `SafeProcessRunner` foundation for validated git/docker compose deployment execution with persisted run records.
- Added Telegram-triggered deployment confirmation and execution flow for configured targets with audited success screens.
- Added monitoring target config loading, HTTP health probes, persisted monitoring samples, and a live Telegram `Monitoring` screen.
- Added active-run deploy blocking and post-deploy health validation using configured health targets before marking deployments successful.
- Added Telegram backup artifact delivery for eligible backup sizes plus explicit fallback messaging when a backup exceeds the configured Telegram limit.
- Added alert rule config loading, persisted `AlertEvent` open/resolve transitions, cooldown-aware repeat suppression, and monitoring-integrated alert summaries.
- Added a background alert evaluation runner that reuses the monitoring cadence, skips the test environment, and keeps alert state moving without manual Telegram interaction.
- Added Telegram-triggered deployment rollback that reuses persisted deployment history, enforces active-run locking, and validates health again after the restored release is applied.
- Added constrained resend of the latest successful backup artifact through Telegram, with file-exists and size-limit checks before delivery.
- Added pending-user onboarding and Telegram confirmation flows for activating or disabling managed users.
