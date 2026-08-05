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
- [ ] M6 Deployment workflow.
- [ ] M7 Database status and backup.
- [ ] M8 Monitoring and alerts.
- [ ] M9 Users and settings.
- [ ] M10 Audit UI and hardening.
- [ ] M11 Documentation and deployment guides.
- [ ] M12 Final validation and deployment readiness.

## In Progress Notes

- [x] Added live Telegram visibility for database connectivity and backup environment readiness.
- [ ] Finish backup execution jobs, retention handling, and downloadable artifacts.
