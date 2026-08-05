# TeleOps Technical Decisions

Updated: 2026-08-05

## Accepted

1. Use Node.js `24.13.1` in `.nvmrc` to match the active LTS toolchain available in the workspace.
2. Start with a single NestJS application and modular boundaries instead of microservices to keep v1 complexity controlled.
3. Use `Zod` as the single source of truth for environment validation from Milestone 0 onward.
4. Use `nestjs-pino` for structured logging so later Telegram, HTTP, and job flows share the same logging pipeline.
5. Keep Telegram UI copy in Vietnamese while source code identifiers remain English, matching the product prompt.
6. System metrics are gathered through `systeminformation` inside a narrow gateway adapter so Telegram and dashboard flows can stay testable with mocks.
7. Docker integration starts with read-only visibility and graceful error handling first; mutation flows will layer on top of the same gateway once confirmation tokens and job execution are wired in.

## Assumptions

1. The GitHub remote `https://github.com/BinCry/Tele-Ops.git` is the canonical `main` branch target for automated pushes.
2. Empty `ENCRYPTION_KEY` is temporarily allowed during Milestone 0 because no encryption-dependent feature is enabled yet; stricter enforcement will land when secure settings/backups require it.
3. Docker, Docker Compose, Node.js, and pnpm are available in the local environment, so local verification can include build/test and later Compose validation.
4. The initial Prisma migration is generated from schema diff because the Docker daemon is unavailable in this environment; it should be applied against a live PostgreSQL instance in a later verification pass.
5. The Telegram shell stays owner-only for now using `TELEGRAM_OWNER_USER_ID` until the user repository and RBAC layer are implemented in the next milestone.
6. The first production-ready rate limit layer is an in-memory per-user throttle for Telegram interactions; Redis-backed distributed throttling can replace it later without changing the Telegram handler contract.
