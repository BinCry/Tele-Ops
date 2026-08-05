#!/usr/bin/env bash
set -Eeuo pipefail

[[ "${NODE_ENV:-}" == "production" ]] || {
  echo "NODE_ENV is not production."
  exit 1
}

[[ -n "${TELEGRAM_BOT_TOKEN:-}" ]] || {
  echo "TELEGRAM_BOT_TOKEN is empty."
  exit 1
}

[[ -n "${TELEGRAM_OWNER_USER_ID:-}" ]] || {
  echo "TELEGRAM_OWNER_USER_ID is empty."
  exit 1
}

if [[ "${DANGEROUS_ACTIONS_ENABLED:-false}" == "true" ]] && [[ -z "${ALLOWED_CONTAINER_NAMES:-}${ALLOWED_COMPOSE_PROJECTS:-}" ]]; then
  echo "Dangerous actions require an allowlist in production."
  exit 1
fi

echo "Production baseline checks passed."
