# TeleOps Technical Decisions

Updated: 2026-08-05

## Accepted

1. Use Node.js `24.13.1` in `.nvmrc` to match the active LTS toolchain available in the workspace.
2. Start with a single NestJS application and modular boundaries instead of microservices to keep v1 complexity controlled.
3. Use `Zod` as the single source of truth for environment validation from Milestone 0 onward.
4. Use `nestjs-pino` for structured logging so later Telegram, HTTP, and job flows share the same logging pipeline.
5. Keep Telegram UI copy in Vietnamese while source code identifiers remain English, matching the product prompt.

## Assumptions

1. The GitHub remote `https://github.com/BinCry/Tele-Ops.git` is the canonical `main` branch target for automated pushes.
2. Empty `ENCRYPTION_KEY` is temporarily allowed during Milestone 0 because no encryption-dependent feature is enabled yet; stricter enforcement will land when secure settings/backups require it.
3. Docker, Docker Compose, Node.js, and pnpm are available in the local environment, so local verification can include build/test and later Compose validation.
4. The initial Prisma migration is generated from schema diff because the Docker daemon is unavailable in this environment; it should be applied against a live PostgreSQL instance in a later verification pass.
