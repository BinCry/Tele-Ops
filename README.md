# TeleOps

TeleOps is a Telegram-based operations bot for managing services running on a VPS. It is being built with NestJS, TypeScript, PostgreSQL, Redis, and Docker-oriented safety controls.

## Current Status

- Milestone 0 foundation is complete.
- Current capabilities: strict NestJS baseline, environment validation with Zod, structured logging with Pino, `/health` endpoint coverage, infrastructure assets for Prisma/PostgreSQL/Redis/Docker/CI, and a Telegram polling shell with Vietnamese home menu rendering.
- Next milestone: persistent auth, RBAC, audit foundations, and rate limiting.

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
- Start local infrastructure with `docker compose up -d postgres redis`.
- Apply the initial schema with `pnpm prisma:migrate:dev --name init`.

## Planning Artifacts

- Architecture and milestone plan: `PLAN.md`
- Execution checklist: `TASKS.md`
- Technical assumptions and decisions: `DECISIONS.md`
- Milestone history: `CHANGELOG.md`
