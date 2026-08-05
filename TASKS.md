# TeleOps Task Board

Updated: 2026-08-05

## Milestone 0 - Repository Foundation

- [x] Inspect current workspace and confirm repository starting point.
- [x] Scaffold NestJS baseline with `pnpm`, strict TypeScript, ESLint, Prettier, and Jest.
- [x] Replace demo files with `ConfigModule`, environment validation, structured logging, and health skeleton.
- [x] Add repository governance files: `PLAN.md`, `TASKS.md`, `DECISIONS.md`, `CHANGELOG.md`.
- [x] Add baseline examples for environment/config files.
- [x] Run `format`, `lint`, `typecheck`, `test`, `test:e2e`, and `build`.
- [x] Commit and push Milestone 0 slice to `main`.

## Milestone 1 - Infrastructure

- [x] Add Prisma schema and initial migration.
- [x] Wire PostgreSQL and Redis configs.
- [x] Create Dockerfile and Compose assets.
- [x] Add CI workflow for install, lint, test, build, and Docker build.
- [ ] Re-run local `docker compose up` and `docker build` once a Docker daemon is available in the environment.

## Milestone 2 - Telegram Shell

- [x] Integrate Telegraf with long polling and callback acknowledgement.
- [x] Build screen rendering, navigation, and edit-or-send behavior.

## Milestone 3 - Auth and RBAC

- [x] Add owner bootstrap, user persistence, role model, and permission checks.
- [x] Add audit foundation and rate limiting.

## Remaining Milestones

- [x] M4 Dashboard and server metrics.
- [ ] M5 Docker management.
- [x] M6 Deployment workflow.
- [ ] M7 Database status and backup.
- [x] M8 Monitoring and alerts.
- [ ] M9 Users and settings.
- [ ] M10 Audit UI and hardening.
- [ ] M11 Documentation and deployment guides.
- [ ] M12 Final validation and deployment readiness.

## In Progress Notes

- [x] Added live Telegram visibility for database connectivity and backup environment readiness.
- [x] Replaced placeholder Telegram screens for users, settings, and audit with read-only data views.
- [x] Enforced backend permission checks before every implemented Telegram feature screen.
- [x] Added persisted Docker action confirmations with backend token validation and role-gated start/stop/restart flows.
- [x] Added backend backup execution foundation with `pg_dump` gateway, persisted `BackupRecord`, checksum generation, and retention cleanup.
- [x] Added Telegram-triggered backup execution with confirmation tokens and audit trail.
- [x] Added deployment target config loading and Telegram deploy overview from YAML configuration.
- [x] Added backend deployment execution foundation with safe process runner, persisted `DeploymentRun`, and target-directory path validation.
- [x] Added Telegram-triggered deployment confirmations and execution for configured targets.
- [x] Added health target config loading, live HTTP probes, persisted monitoring samples, and a Telegram `Monitoring` screen.
- [x] Added deployment soft-locking against active `RUNNING` targets and post-deploy health validation through configured monitoring targets.
- [x] Added Telegram backup artifact delivery for eligible backup sizes with configured size-limit fallback messaging.
- [x] Added alert rule config loading, `AlertEvent` open/resolve lifecycle, cooldown-aware notification suppression, and monitoring-integrated alert summaries.
- [x] Added background alert evaluation scheduling so monitoring samples and alert lifecycle keep running without a manual Telegram refresh.
- [x] Added confirmed deployment rollback from Telegram using persisted deployment history, commit checkout, and post-rollback health validation.
- [ ] Finish backup artifact delivery and download constraints.
- [ ] Add queued execution and richer per-container drill-down for Docker mutations.
