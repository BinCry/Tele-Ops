export const TELEGRAM_CALLBACKS = {
  home: 'nav:home',
  refresh: 'nav:refresh',
  dashboard: 'nav:dashboard',
  server: 'nav:server',
  docker: 'nav:docker',
  logs: 'nav:logs',
  deploy: 'nav:deploy',
  monitoring: 'nav:monitoring',
  users: 'nav:users',
  settings: 'nav:settings',
} as const;

export type TelegramCallback =
  (typeof TELEGRAM_CALLBACKS)[keyof typeof TELEGRAM_CALLBACKS];
