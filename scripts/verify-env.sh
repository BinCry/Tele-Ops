#!/usr/bin/env bash
set -Eeuo pipefail

required_vars=(
  TELEGRAM_BOT_TOKEN
  TELEGRAM_OWNER_USER_ID
  DATABASE_URL
  REDIS_URL
  DOCKER_HOST
)

missing=0

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}"
    missing=1
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  exit 1
fi

if [[ ! -f "${DEPLOY_TARGETS_CONFIG_PATH:-config/deploy-targets.yaml}" ]]; then
  echo "Deploy targets config file not found."
fi

if [[ ! -f "${HEALTH_TARGETS_CONFIG_PATH:-config/health-targets.yaml}" ]]; then
  echo "Health targets config file not found."
fi

if [[ ! -f "${ALERT_RULES_CONFIG_PATH:-config/alert-rules.yaml}" ]]; then
  echo "Alert rules config file not found."
fi

echo "Environment verification completed."
