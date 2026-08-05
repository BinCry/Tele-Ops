export const PERMISSIONS = {
  dashboardView: 'dashboard.view',
  serverView: 'server.view',
  dockerView: 'docker.view',
  logsView: 'logs.view',
  deployRun: 'deploy.run',
  databaseView: 'database.view',
  backupRun: 'backup.run',
  monitoringView: 'monitoring.view',
  usersManage: 'users.manage',
  settingsManage: 'settings.manage',
  auditView: 'audit.view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
