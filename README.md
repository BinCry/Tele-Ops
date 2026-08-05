# TeleOps

TeleOps is a Telegram-based operations bot for managing services running on a VPS. It is being built with NestJS, TypeScript, PostgreSQL, Redis, and Docker-oriented safety controls.

![Node.js](https://img.shields.io/badge/Node.js-24.13.1-5FA04E?logo=node.js&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-8-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Telegraf](https://img.shields.io/badge/Telegram-Telegraf-26A5E4?logo=telegram&logoColor=white)
![Jest](https://img.shields.io/badge/Test-Jest-C21325?logo=jest&logoColor=white)

## Current Status

- Milestones 0 through 4 and 6 through 9 are complete and pushed in staged slices.
- Current capabilities: Telegram auth/RBAC, audit trail, rate limiting, dashboard/server visibility, Docker visibility plus confirmed mutations, PostgreSQL status/backup execution with direct Telegram artifact delivery when size permits plus constrained resend of the latest successful artifact, deploy target execution plus confirmed rollback with active-run guard and post-action health validation, live monitoring overview from health targets, alert rule evaluation with persisted lifecycle plus background polling and optional Telegram notifications, Telegram-based pending-user activation or disable flows for access control, and runtime settings overrides for dangerous Docker actions plus confirmation TTL from the Telegram `Settings` screen.
- Current gaps before deploy-ready: queued Docker execution and richer drill-down, operations and incident runbooks, and live Docker/Compose validation in an environment with a Docker daemon.

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
- Runtime overrides for `dangerous actions` and `confirmation TTL` are persisted in the `Setting` table and can be changed from the Telegram `Settings` screen without an application restart.
- `MONITOR_SAMPLE_INTERVAL_SECONDS` controls the shared monitoring and alert polling cadence.
- Start local infrastructure with `docker compose up -d postgres redis`.
- Apply the initial schema with `pnpm prisma:migrate:dev --name init`.

## Planning Artifacts

- Architecture and milestone plan: `PLAN.md`
- Execution checklist: `TASKS.md`
- Technical assumptions and decisions: `DECISIONS.md`
- Milestone history: `CHANGELOG.md`
