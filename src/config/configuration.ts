import { EnvironmentVariables } from './env.schema';

function parseCsvList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export const configuration = () => {
  const env = process.env as Record<
    keyof EnvironmentVariables,
    string | undefined
  >;

  return {
    app: {
      name: env.APP_NAME ?? 'TeleOps',
      environment: env.NODE_ENV ?? 'development',
      timezone: env.APP_TIMEZONE ?? 'Asia/Ho_Chi_Minh',
      port: Number(env.PORT ?? 3000),
      logLevel: env.LOG_LEVEL ?? 'info',
    },
    telegram: {
      mode: env.TELEGRAM_MODE ?? 'polling',
      ownerUserId: env.TELEGRAM_OWNER_USER_ID ?? '',
      alertChatId: env.TELEGRAM_ALERT_CHAT_ID ?? '',
    },
    security: {
      dangerousActionsEnabled: env.DANGEROUS_ACTIONS_ENABLED === 'true',
      confirmationTtlSeconds: Number(env.CONFIRMATION_TTL_SECONDS ?? 60),
      actionRateLimitPerMinute: Number(env.ACTION_RATE_LIMIT_PER_MINUTE ?? 20),
      encryptionKeyConfigured: Boolean(env.ENCRYPTION_KEY),
    },
    allowlists: {
      containers: parseCsvList(env.ALLOWED_CONTAINER_NAMES ?? ''),
      composeProjects: parseCsvList(env.ALLOWED_COMPOSE_PROJECTS ?? ''),
    },
    paths: {
      deployTargetsConfig:
        env.DEPLOY_TARGETS_CONFIG_PATH ?? '/app/config/deploy-targets.yaml',
      healthTargetsConfig:
        env.HEALTH_TARGETS_CONFIG_PATH ?? '/app/config/health-targets.yaml',
      alertRulesConfig:
        env.ALERT_RULES_CONFIG_PATH ?? '/app/config/alert-rules.yaml',
      backupDirectory: env.BACKUP_DIRECTORY ?? '/data/backups',
    },
  };
};
