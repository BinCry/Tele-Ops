# Backup Runbook

Updated: 2026-08-05

## What TeleOps Supports

- Database status visibility
- `pg_dump` backup execution through Telegram
- Persisted backup records with checksums
- Automatic Telegram artifact delivery when the file fits the configured size limit
- Re-send of the latest successful artifact when the file still exists locally

## Operator Flow

1. Open `Database` to verify connectivity.
2. Open `Backup`.
3. Trigger `Tạo backup` and confirm the token.
4. Wait for the backup success screen.
5. Download the Telegram document immediately if one is delivered.

## Retention

- Files are stored under `BACKUP_DIRECTORY`.
- Retention days are controlled by `BACKUP_RETENTION_DAYS`.
- Telegram re-delivery is constrained by `BACKUP_MAX_TELEGRAM_SIZE_MB`.

## Restore Caveat

Database restore remains disabled by default with `DATABASE_RESTORE_ENABLED=false`. Recovery should currently be handled as a manual operator action outside the bot.
