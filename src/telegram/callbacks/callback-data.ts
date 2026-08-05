export const TELEGRAM_CALLBACKS = {
  home: 'nav:home',
  refresh: 'nav:refresh',
  dashboard: 'nav:dashboard',
  server: 'nav:server',
  docker: 'nav:docker',
  logs: 'nav:logs',
  deploy: 'nav:deploy',
  database: 'nav:database',
  backup: 'nav:backup',
  monitoring: 'nav:monitoring',
  users: 'nav:users',
  settings: 'nav:settings',
  audit: 'nav:audit',
} as const;

export type TelegramCallback =
  (typeof TELEGRAM_CALLBACKS)[keyof typeof TELEGRAM_CALLBACKS];

export type DockerActionCallbackPayload = {
  action: 'start' | 'stop' | 'restart';
  containerShortId: string;
};

export type UserStatusActionCallbackPayload = {
  action: 'activate' | 'disable';
  targetTelegramUserId: string;
};

const DOCKER_ACTION_PREFIX = 'action:docker';
const USER_STATUS_ACTION_PREFIX = 'action:user';
const DEPLOY_RUN_PREFIX = 'action:deploy:run';
const DEPLOY_ROLLBACK_PREFIX = 'action:deploy:rollback';
const BACKUP_CREATE_CALLBACK = 'action:backup:create';
const BACKUP_DOWNLOAD_LATEST_CALLBACK = 'action:backup:download-latest';
const ACTION_CONFIRM_PREFIX = 'action:confirm';
const ACTION_CANCEL_PREFIX = 'action:cancel';

export function buildDockerActionCallback(
  action: DockerActionCallbackPayload['action'],
  containerShortId: string,
): string {
  return `${DOCKER_ACTION_PREFIX}:${action}:${containerShortId}`;
}

export function parseDockerActionCallback(
  value: string,
): DockerActionCallbackPayload | null {
  const match = value.match(
    /^action:docker:(start|stop|restart):([a-zA-Z0-9]{1,12})$/,
  );

  if (!match) {
    return null;
  }

  return {
    action: match[1] as DockerActionCallbackPayload['action'],
    containerShortId: match[2] ?? '',
  };
}

export function buildUserStatusActionCallback(
  action: UserStatusActionCallbackPayload['action'],
  targetTelegramUserId: string,
): string {
  return `${USER_STATUS_ACTION_PREFIX}:${action}:${targetTelegramUserId}`;
}

export function parseUserStatusActionCallback(
  value: string,
): UserStatusActionCallbackPayload | null {
  const match = value.match(/^action:user:(activate|disable):([0-9]{1,20})$/);

  if (!match) {
    return null;
  }

  return {
    action: match[1] as UserStatusActionCallbackPayload['action'],
    targetTelegramUserId: match[2] ?? '',
  };
}

export function buildBackupCreateCallback(): string {
  return BACKUP_CREATE_CALLBACK;
}

export function isBackupCreateCallback(value: string): boolean {
  return value === BACKUP_CREATE_CALLBACK;
}

export function buildBackupDownloadLatestCallback(): string {
  return BACKUP_DOWNLOAD_LATEST_CALLBACK;
}

export function isBackupDownloadLatestCallback(value: string): boolean {
  return value === BACKUP_DOWNLOAD_LATEST_CALLBACK;
}

export function buildDeployRunCallback(targetName: string): string {
  return `${DEPLOY_RUN_PREFIX}:${targetName}`;
}

export function parseDeployRunCallback(value: string): string | null {
  const match = value.match(/^action:deploy:run:([a-z0-9-]{1,32})$/);
  return match?.[1] ?? null;
}

export function buildDeployRollbackCallback(targetName: string): string {
  return `${DEPLOY_ROLLBACK_PREFIX}:${targetName}`;
}

export function parseDeployRollbackCallback(value: string): string | null {
  const match = value.match(/^action:deploy:rollback:([a-z0-9-]{1,32})$/);
  return match?.[1] ?? null;
}

export function buildActionConfirmCallback(token: string): string {
  return `${ACTION_CONFIRM_PREFIX}:${token}`;
}

export function parseActionConfirmCallback(value: string): string | null {
  const match = value.match(/^action:confirm:([a-f0-9-]{36})$/i);
  return match?.[1] ?? null;
}

export function buildActionCancelCallback(token: string): string {
  return `${ACTION_CANCEL_PREFIX}:${token}`;
}

export function parseActionCancelCallback(value: string): string | null {
  const match = value.match(/^action:cancel:([a-f0-9-]{36})$/i);
  return match?.[1] ?? null;
}
