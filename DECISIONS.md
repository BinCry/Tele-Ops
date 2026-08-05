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
7. Database and backup milestone work starts with read-only health and environment probes in Telegram so operators can validate prerequisites before destructive backup execution is enabled.
8. Every implemented Telegram feature screen must enforce backend permission checks before loading service data, even when the button is hidden in the UI for lower roles.
9. Docker mutations use persisted confirmation tokens in `ActionRequest` records so approval is single-use, time-bounded, actor-bound, and auditable from the start.
10. Backup execution is implemented behind a dedicated PostgreSQL backup gateway so `pg_dump` invocation, checksuming, and retention cleanup stay outside Telegram transport code.
11. Backup creation reuses the same confirmation-token flow as Docker mutations so destructive operational actions share one audit and expiry model.
12. Deployment targets are sourced from a validated YAML file first so production-safe target definitions stay explicit and out of Telegram free-form input.
13. Deployment command execution is isolated behind a safe process runner so file-path validation and argument construction stay centralized before Telegram is allowed to trigger real deploys.
14. Telegram deployment actions reuse the same persisted confirmation-token model as Docker and backup flows so risky operations stay actor-bound, time-bounded, and fully auditable.
15. Monitoring targets are sourced from validated YAML and probed through a dedicated HTTP gateway so Telegram can show live health without embedding fetch logic in handlers.
16. Deployments now refuse to start when the same target already has a `RUNNING` record and validate an optional linked health target before the run is marked successful.
17. Successful backups now attempt direct Telegram document delivery only when the artifact size is within the configured limit, avoiding oversized upload failures in the main action flow.
18. Alert rules are evaluated from the live monitoring snapshot first, with `AlertEvent` persistence and cooldown-aware notification suppression, before adding a separate background scheduler.
19. Background alert evaluation now runs inside `AlertsModule` on startup and on the shared monitoring interval, while skipping the test environment to keep automated test runs deterministic.
20. Deployment rollback reuses the latest reversible `DeploymentRun` history, restoring the previous commit through the same confirmation, locking, and post-action health-check pipeline as forward deploys.
21. Backup artifact re-delivery is limited to the latest successful persisted backup and re-validates local file existence plus Telegram size limits before sending any file back to chat.
22. First-pass user management prefers safe status transitions over free-form edits: unknown Telegram users self-register as `PENDING`, while admins and owners can only activate or disable managed accounts through confirmation tokens.
23. Runtime safety toggles for dangerous Docker actions and confirmation TTL are stored in the `Setting` table so operators can adjust safeguards from Telegram without editing env files or restarting the app.
