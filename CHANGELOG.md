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
