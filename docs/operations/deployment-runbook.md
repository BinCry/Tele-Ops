# Deployment Runbook

Updated: 2026-08-05

## Preconditions

- Node.js `24.13.1`, `pnpm`, Docker, and Docker Compose are installed on the target host.
- `.env` is populated from `.env.example`.
- `config/deploy-targets.yaml`, `config/health-targets.yaml`, and `config/alert-rules.yaml` exist with production values.
- `scripts/production-check.sh` passes with `NODE_ENV=production`.

## Preflight

```bash
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm test -- --runInBand
pnpm test:e2e
pnpm build
```

For local container smoke tests without a real bot token, set `TELEGRAM_MODE=disabled`.

## Bootstrap on a Host

```bash
cp .env.example .env
cp config/deploy-targets.example.yaml config/deploy-targets.yaml
cp config/health-targets.example.yaml config/health-targets.yaml
cp config/alert-rules.example.yaml config/alert-rules.yaml
docker compose -f docker-compose.production.yml up -d --build
```

The production container now runs `pnpm prisma:migrate:deploy` automatically before `node dist/src/main.js`, so a fresh database receives the schema during boot.

## Telegram-Controlled Deployment

1. Open the `Deploy` screen in Telegram.
2. Select an enabled target.
3. Confirm the action token.
4. Wait for the post-deploy status message.
5. If a health target is attached, verify the deployment stayed healthy.

## Exit Criteria

- `/health` responds successfully.
- The `Deploy` screen shows the expected target and branch.
- The `Monitoring` screen shows linked health targets as healthy.
- The `Audit` screen records the deployment request and execution.
