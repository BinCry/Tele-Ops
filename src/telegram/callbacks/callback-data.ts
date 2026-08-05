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
