import { z } from 'zod';

const csvString = z.string().trim().optional().default('');
const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === 'true') {
      return true;
    }

    if (normalizedValue === 'false') {
      return false;
    }
  }

  return value;
}, z.boolean());

export const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    APP_NAME: z.string().trim().min(1).default('TeleOps'),
    APP_TIMEZONE: z.string().trim().min(1).default('Asia/Ho_Chi_Minh'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    TELEGRAM_BOT_TOKEN: z
      .string()
      .trim()
      .min(1, 'TELEGRAM_BOT_TOKEN is required'),
    TELEGRAM_OWNER_USER_ID: z
      .string()
      .trim()
      .regex(
        /^\d+$/,
        'TELEGRAM_OWNER_USER_ID must be a numeric Telegram user id',
      ),
    TELEGRAM_ALERT_CHAT_ID: z.string().trim().optional(),
    TELEGRAM_MODE: z.enum(['polling', 'disabled']).default('polling'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    DOCKER_HOST: z.string().trim().min(1),
    DANGEROUS_ACTIONS_ENABLED: booleanFromEnv.default(false),
    CONFIRMATION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(3600)
      .default(60),
    ACTION_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .min(1)
      .max(600)
      .default(20),
    ALLOWED_CONTAINER_NAMES: csvString,
    ALLOWED_COMPOSE_PROJECTS: csvString,
    DEPLOY_TARGETS_CONFIG_PATH: z.string().trim().min(1),
    HEALTH_TARGETS_CONFIG_PATH: z.string().trim().min(1),
    ALERT_RULES_CONFIG_PATH: z.string().trim().min(1),
    BACKUP_DIRECTORY: z.string().trim().min(1),
    BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(7),
    BACKUP_MAX_TELEGRAM_SIZE_MB: z.coerce
      .number()
      .int()
      .min(1)
      .max(200)
      .default(20),
    MONITOR_SAMPLE_INTERVAL_SECONDS: z.coerce
      .number()
      .int()
      .min(5)
      .max(3600)
      .default(60),
    MONITOR_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(7),
    LIVE_MONITOR_INTERVAL_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .max(300)
      .default(10),
    LIVE_MONITOR_MAX_DURATION_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(3600)
      .default(120),
    DATABASE_BACKUP_ENABLED: booleanFromEnv.default(true),
    DATABASE_RESTORE_ENABLED: booleanFromEnv.default(false),
    ENCRYPTION_KEY: z.string().optional().default(''),
  })
  .superRefine((env, ctx) => {
    const hasAllowlist =
      env.ALLOWED_CONTAINER_NAMES.length > 0 ||
      env.ALLOWED_COMPOSE_PROJECTS.length > 0;

    if (
      env.NODE_ENV === 'production' &&
      env.DANGEROUS_ACTIONS_ENABLED &&
      !hasAllowlist
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DANGEROUS_ACTIONS_ENABLED'],
        message:
          'Production dangerous actions require ALLOWED_CONTAINER_NAMES or ALLOWED_COMPOSE_PROJECTS.',
      });
    }

    if (env.ENCRYPTION_KEY.length > 0 && env.ENCRYPTION_KEY.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ENCRYPTION_KEY'],
        message: 'ENCRYPTION_KEY must be at least 32 characters when provided.',
      });
    }
  });

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  rawConfig: Record<string, unknown>,
): EnvironmentVariables {
  return environmentSchema.parse(rawConfig);
}
