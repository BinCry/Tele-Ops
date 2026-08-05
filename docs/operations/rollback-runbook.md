# Rollback Runbook

Updated: 2026-08-05

## When To Roll Back

- The latest deployment finishes but health checks fail.
- Telegram monitoring or alerting shows a degraded or down target after release.
- Operators confirm the new release introduced a regression.

## Telegram Rollback Flow

1. Open the `Deploy` screen.
2. Choose `Rollback <target>`.
3. Review the previewed rollback commit.
4. Confirm the rollback token.
5. Watch for the success message containing the restored commit hash.

## After Rollback

- Verify `Monitoring` returns to healthy.
- Inspect `Logs` and `Audit` for any follow-up errors.
- Record the failed deployment commit for later investigation.

## Manual Fallback

If Telegram is unavailable but the host is reachable:

```bash
cd /opt/teleops
git checkout <known-good-commit>
docker compose -f docker-compose.yml up -d --build
```

Use the compose file configured for the affected deployment target, not a guessed filename.
