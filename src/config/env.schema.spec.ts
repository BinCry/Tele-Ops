import { validateEnvironment } from './env.schema';

const baseEnvironment = {
  NODE_ENV: 'production',
  APP_NAME: 'TeleOps',
  APP_TIMEZONE: 'Asia/Ho_Chi_Minh',
  LOG_LEVEL: 'info',
  PORT: '3000',
  TELEGRAM_BOT_TOKEN: 'test-token',
  TELEGRAM_OWNER_USER_ID: '123456789',
  TELEGRAM_ALERT_CHAT_ID: '',
  TELEGRAM_MODE: 'polling',
  DATABASE_URL: 'postgresql://teleops:teleops@localhost:5432/teleops',
  REDIS_URL: 'redis://localhost:6379',
  DOCKER_HOST: 'unix:///var/run/docker.sock',
  DANGEROUS_ACTIONS_ENABLED: 'false',
  CONFIRMATION_TTL_SECONDS: '60',
  ACTION_RATE_LIMIT_PER_MINUTE: '20',
  ALLOWED_CONTAINER_NAMES: '',
  ALLOWED_COMPOSE_PROJECTS: '',
  DEPLOY_TARGETS_CONFIG_PATH: '/app/config/deploy-targets.yaml',
  HEALTH_TARGETS_CONFIG_PATH: '/app/config/health-targets.yaml',
  ALERT_RULES_CONFIG_PATH: '/app/config/alert-rules.yaml',
  BACKUP_DIRECTORY: '/data/backups',
  BACKUP_RETENTION_DAYS: '7',
  BACKUP_MAX_TELEGRAM_SIZE_MB: '20',
  MONITOR_SAMPLE_INTERVAL_SECONDS: '60',
  MONITOR_RETENTION_DAYS: '7',
  LIVE_MONITOR_INTERVAL_SECONDS: '10',
  LIVE_MONITOR_MAX_DURATION_SECONDS: '120',
  DATABASE_BACKUP_ENABLED: 'false',
  DATABASE_RESTORE_ENABLED: 'false',
  ENCRYPTION_KEY: '',
} satisfies Record<string, string>;

describe('validateEnvironment', () => {
  it('parses string booleans without turning "false" into true', () => {
    const parsedEnvironment = validateEnvironment(baseEnvironment);

    expect(parsedEnvironment.DANGEROUS_ACTIONS_ENABLED).toBe(false);
    expect(parsedEnvironment.DATABASE_BACKUP_ENABLED).toBe(false);
    expect(parsedEnvironment.DATABASE_RESTORE_ENABLED).toBe(false);
  });

  it('accepts disabled telegram mode for local smoke tests', () => {
    const parsedEnvironment = validateEnvironment({
      ...baseEnvironment,
      NODE_ENV: 'development',
      TELEGRAM_MODE: 'disabled',
    });

    expect(parsedEnvironment.TELEGRAM_MODE).toBe('disabled');
  });
});
