# TeleOps Task Board

Updated: 2026-08-05

## Milestone 0 - Repository Foundation

- [x] Inspect current workspace and confirm repository starting point.
- [x] Scaffold NestJS baseline with `pnpm`, strict TypeScript, ESLint, Prettier, and Jest.
- [x] Replace demo files with `ConfigModule`, environment validation, structured logging, and health skeleton.
- [x] Add repository governance files: `PLAN.md`, `TASKS.md`, `DECISIONS.md`, `CHANGELOG.md`.
- [x] Add baseline examples for environment/config files.
- [x] Run `format`, `lint`, `typecheck`, `test`, `test:e2e`, and `build`.
- [ ] Commit and push Milestone 0 slice to `main`.

## Milestone 1 - Infrastructure

- [ ] Add Prisma schema and initial migration.
- [ ] Wire PostgreSQL and Redis configs.
- [ ] Create Dockerfile and Compose assets.
- [ ] Add CI workflow for install, lint, test, build, and Docker build.

## Milestone 2 - Telegram Shell

- [ ] Integrate Telegraf with long polling and callback acknowledgement.
- [ ] Build screen rendering, navigation, and edit-or-send behavior.

## Milestone 3 - Auth and RBAC

- [ ] Add owner bootstrap, user persistence, role model, and permission checks.
- [ ] Add audit foundation and rate limiting.

## Remaining Milestones

- [ ] M4 Dashboard and server metrics.
- [ ] M5 Docker management.
- [ ] M6 Deployment workflow.
- [ ] M7 Database status and backup.
- [ ] M8 Monitoring and alerts.
- [ ] M9 Users and settings.
- [ ] M10 Audit UI and hardening.
- [ ] M11 Documentation and deployment guides.
- [ ] M12 Final validation and deployment readiness.
