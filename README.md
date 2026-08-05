# TeleOps

TeleOps is a Telegram-based operations bot for managing services running on a VPS. It is being built with NestJS, TypeScript, PostgreSQL, Redis, and Docker-oriented safety controls.

### 🛠️ Tech Stack

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-24.13.1-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-8-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Telegraf-Telegram-26A5E4?style=flat-square&logo=telegram&logoColor=white" alt="Telegraf" />
  <img src="https://img.shields.io/badge/Jest-Test-C21325?style=flat-square&logo=jest&logoColor=white" alt="Jest" />
</p>

## Current Status

- Milestones 0 through 12 are complete and pushed in staged slices.
- Current capabilities: Telegram auth/RBAC, audit trail, rate limiting, dashboard/server visibility, Docker visibility plus confirmed mutations, PostgreSQL status/backup execution with direct Telegram artifact delivery when size permits plus constrained resend of the latest successful artifact, deploy target execution plus confirmed rollback with active-run guard and post-action health validation, live monitoring overview from health targets, alert rule evaluation with persisted lifecycle plus background polling and optional Telegram notifications, Telegram-based pending-user activation or disable flows for access control, runtime settings overrides for dangerous Docker actions plus confirmation TTL from the Telegram `Settings` screen, audit-payload redaction, production image startup migrations, and `TELEGRAM_MODE=disabled` for smoke validation.
- Deploy-ready validation completed on Wednesday, August 5, 2026 with `pnpm lint`, `pnpm typecheck`, `pnpm test -- --runInBand`, `pnpm test:e2e`, `pnpm build`, `docker build .`, `docker compose up -d --build`, healthy container checks, and `docker compose down`.

## Tech Stack

- Node.js `24.13.1`
- NestJS
- TypeScript strict mode
- pnpm
- Zod
- Pino / `nestjs-pino`
- Prisma
- PostgreSQL
- Redis
- Jest + Supertest

## Local Development

```bash
pnpm install
pnpm prisma:generate
pnpm start:dev
```

## Quality Checks

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm prisma:generate
pnpm test
pnpm test:e2e
pnpm build
```

## Configuration

- Copy `.env.example` to `.env`.
- Fill in Telegram, database, Redis, and deployment-related environment values.
- Baseline config examples live in `config/*.example.yaml`.
- `TELEGRAM_MODE=disabled` is supported for local smoke tests or container validation when the app should boot without connecting to Telegram.
- Runtime overrides for `dangerous actions` and `confirmation TTL` are persisted in the `Setting` table and can be changed from the Telegram `Settings` screen without an application restart.
- `MONITOR_SAMPLE_INTERVAL_SECONDS` controls the shared monitoring and alert polling cadence.
- Start local infrastructure with `docker compose up -d postgres redis`.
- Apply the initial schema with `pnpm prisma:migrate:dev --name init`.

## Operations Docs

- Architecture overview: `docs/architecture/system-architecture.md`
- Threat model: `docs/security/threat-model.md`
- Deployment runbook: `docs/operations/deployment-runbook.md`
- Rollback runbook: `docs/operations/rollback-runbook.md`
- Backup runbook: `docs/operations/backup-runbook.md`
- Incident response: `docs/operations/incident-response.md`
- Readiness report: `docs/testing/deployment-readiness-report.md`

## Post-v1 Backlog

- Richer per-container Docker drill-down and queued execution can land as follow-up enhancements without blocking deployment readiness.

## Planning Artifacts

- Architecture and milestone plan: `PLAN.md`
- Execution checklist: `TASKS.md`
- Technical assumptions and decisions: `DECISIONS.md`
- Milestone history: `CHANGELOG.md`
