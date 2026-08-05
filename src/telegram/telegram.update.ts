import { AuditResult, UserRole, UserStatus } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Input } from 'telegraf';
import { TelegramRateLimitService } from 'src/common/rate-limit/telegram-rate-limit.service';
import { ActionRequestService } from 'src/modules/action-request/action-request.service';
import { AlertsService } from 'src/modules/alerts/alerts.service';
import { AuthService } from 'src/modules/auth/auth.service';
import { AuditService } from 'src/modules/audit/audit.service';
import {
  BackupArtifactResult,
  BackupExecutionResult,
  BackupService,
} from 'src/modules/backup/backup.service';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import {
  DeploymentExecutionResult,
  DeploymentRollbackPreview,
  DeploymentRollbackResult,
  DeploymentService,
} from 'src/modules/deploy/deployment.service';
import { DeployTargetsService } from 'src/modules/deploy/deploy-targets.service';
import { DockerService } from 'src/modules/docker/docker.service';
import { MonitoringService } from 'src/modules/monitoring/monitoring.service';
import { PERMISSIONS, Permission } from 'src/modules/rbac/permissions';
import { RbacService } from 'src/modules/rbac/rbac.service';
import { ServerService } from 'src/modules/server/server.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { UsersService } from 'src/modules/users/users.service';
import {
  buildActionCancelCallback,
  buildActionConfirmCallback,
  buildBackupCreateCallback,
  buildBackupDownloadLatestCallback,
  buildDeployRollbackCallback,
  buildDeployRunCallback,
  buildDockerActionCallback,
  buildUserStatusActionCallback,
  isBackupDownloadLatestCallback,
  isBackupCreateCallback,
  parseActionCancelCallback,
  parseActionConfirmCallback,
  parseDeployRollbackCallback,
  parseDeployRunCallback,
  parseDockerActionCallback,
  parseUserStatusActionCallback,
  TELEGRAM_CALLBACKS,
  TelegramCallback,
} from './callbacks/callback-data';
import { TelegramBotContext } from './context/telegram-context';
import { buildKeyboard } from './keyboards/home.keyboard';
import { TelegramNavigationService } from './navigation/navigation.service';
import { TelegramMenuRenderer } from './renderers/menu-renderer.service';

const FEATURE_LABELS: Record<TelegramCallback, string> = {
  'nav:home': 'Home',
  'nav:refresh': 'Home',
  'nav:dashboard': 'Dashboard',
  'nav:server': 'Server',
  'nav:docker': 'Docker',
  'nav:logs': 'Logs',
  'nav:deploy': 'Deploy',
  'nav:database': 'Database',
  'nav:backup': 'Backup',
  'nav:monitoring': 'Monitoring',
  'nav:users': 'Users',
  'nav:settings': 'Settings',
  'nav:audit': 'Audit',
};

const CALLBACK_PERMISSIONS: Partial<Record<TelegramCallback, Permission>> = {
  'nav:dashboard': PERMISSIONS.dashboardView,
  'nav:server': PERMISSIONS.serverView,
  'nav:docker': PERMISSIONS.dockerView,
  'nav:logs': PERMISSIONS.logsView,
  'nav:deploy': PERMISSIONS.deployRun,
  'nav:database': PERMISSIONS.databaseView,
  'nav:backup': PERMISSIONS.backupRun,
  'nav:monitoring': PERMISSIONS.monitoringView,
  'nav:users': PERMISSIONS.usersManage,
  'nav:settings': PERMISSIONS.settingsManage,
  'nav:audit': PERMISSIONS.auditView,
};

@Injectable()
export class TelegramUpdate {
  constructor(
    private readonly actionRequestService: ActionRequestService,
    private readonly authService: AuthService,
    private readonly alertsService: AlertsService,
    private readonly auditService: AuditService,
    private readonly rbacService: RbacService,
    private readonly rateLimitService: TelegramRateLimitService,
    private readonly backupService: BackupService,
    private readonly dashboardService: DashboardService,
    private readonly deploymentService: DeploymentService,
    private readonly deployTargetsService: DeployTargetsService,
    private readonly dockerService: DockerService,
    private readonly monitoringService: MonitoringService,
    private readonly serverService: ServerService,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
    private readonly navigationService: TelegramNavigationService,
    private readonly menuRenderer: TelegramMenuRenderer,
    private readonly logger: PinoLogger,
  ) {}

  async handleStart(context: TelegramBotContext): Promise<void> {
    const authorizationResult =
      await this.authService.authorizeTelegramContext(context);

    if (authorizationResult.status === 'unauthorized') {
      await this.auditService.record({
        action: 'telegram.start',
        resourceType: 'telegram',
        resourceId: authorizationResult.telegramUserId,
        requestId: String(context.update.update_id ?? ''),
        payloadJson: {
          reason: authorizationResult.reason,
        },
        result: AuditResult.DENIED,
      });

      await this.menuRenderer.renderScreen(
        context,
        this.navigationService.buildUnauthorizedScreen(
          authorizationResult.telegramUserId,
          authorizationResult.message,
        ),
      );
      return;
    }

    await this.auditService.record({
      actorUserId: authorizationResult.user.id,
      action: 'telegram.start',
      resourceType: 'telegram',
      resourceId: authorizationResult.user.telegramUserId,
      requestId: String(context.update.update_id ?? ''),
      result: AuditResult.SUCCESS,
    });

    await this.menuRenderer.renderScreen(
      context,
      this.navigationService.buildHomeScreen({
        displayName: authorizationResult.user.displayName,
        role: authorizationResult.user.role,
      }),
    );
  }

  async handleCancel(context: TelegramBotContext): Promise<void> {
    await context.reply(
      '❌ Đã hủy thao tác hiện tại. Bạn có thể bắt đầu lại từ Home.',
      {
        parse_mode: 'HTML',
      },
    );

    await this.handleStart(context);
  }

  async handleCallback(
    context: TelegramBotContext,
    callbackData: string,
  ): Promise<void> {
    const rateLimitKey = `telegram:${String(context.from?.id ?? 'unknown')}`;
    const rateLimitResult = this.rateLimitService.consume(rateLimitKey);

    if (!rateLimitResult.allowed) {
      await context.answerCbQuery(
        `Bạn thao tác quá nhanh. Hãy thử lại sau ${rateLimitResult.retryAfterSeconds}s.`,
        {
          show_alert: true,
        },
      );
      return;
    }

    const dockerActionPayload = parseDockerActionCallback(callbackData);
    const userStatusActionPayload = parseUserStatusActionCallback(callbackData);
    const backupCreateRequested = isBackupCreateCallback(callbackData);
    const backupDownloadLatestRequested =
      isBackupDownloadLatestCallback(callbackData);
    const deployRunTargetName = parseDeployRunCallback(callbackData);
    const deployRollbackTargetName = parseDeployRollbackCallback(callbackData);
    const confirmToken = parseActionConfirmCallback(callbackData);
    const cancelToken = parseActionCancelCallback(callbackData);
    const navigationCallback = this.isNavigationCallback(callbackData)
      ? callbackData
      : null;

    if (
      !navigationCallback &&
      !dockerActionPayload &&
      !userStatusActionPayload &&
      !backupCreateRequested &&
      !backupDownloadLatestRequested &&
      !deployRunTargetName &&
      !deployRollbackTargetName &&
      !confirmToken &&
      !cancelToken
    ) {
      await context.answerCbQuery('Tác vụ không hợp lệ.', {
        show_alert: true,
      });
      return;
    }

    const authorizationResult =
      await this.authService.authorizeTelegramContext(context);

    if (authorizationResult.status === 'unauthorized') {
      await context.answerCbQuery(authorizationResult.message, {
        show_alert: true,
      });
      await this.auditService.record({
        action: 'telegram.callback',
        resourceType: 'telegram_callback',
        resourceId: callbackData,
        requestId: String(context.update.update_id ?? ''),
        payloadJson: {
          reason: authorizationResult.reason,
          telegramUserId: authorizationResult.telegramUserId,
        },
        result: AuditResult.DENIED,
      });
      await this.menuRenderer.renderScreen(
        context,
        this.navigationService.buildUnauthorizedScreen(
          authorizationResult.telegramUserId,
          authorizationResult.message,
        ),
      );
      return;
    }

    if (confirmToken) {
      await this.handleConfirmationCallback(
        context,
        authorizationResult.user.id,
        authorizationResult.user.role,
        confirmToken,
      );
      return;
    }

    if (cancelToken) {
      await this.handleCancellationCallback(
        context,
        authorizationResult.user.id,
        authorizationResult.user.role,
        cancelToken,
      );
      return;
    }

    if (
      navigationCallback === TELEGRAM_CALLBACKS.home ||
      navigationCallback === TELEGRAM_CALLBACKS.refresh
    ) {
      await context.answerCbQuery('Đang làm mới Home...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.refresh',
        resourceType: 'telegram_callback',
        resourceId: navigationCallback,
        requestId: String(context.update.update_id ?? ''),
        result: AuditResult.SUCCESS,
      });
      await this.menuRenderer.renderScreen(
        context,
        this.navigationService.buildHomeScreen({
          displayName: authorizationResult.user.displayName,
          role: authorizationResult.user.role,
        }),
      );
      return;
    }

    if (backupCreateRequested) {
      await this.handleBackupCreateRequest(
        context,
        authorizationResult.user.id,
        authorizationResult.user.role,
      );
      return;
    }

    if (backupDownloadLatestRequested) {
      await this.handleLatestBackupDeliveryRequest(
        context,
        authorizationResult.user.id,
        authorizationResult.user.role,
      );
      return;
    }

    if (userStatusActionPayload) {
      await this.handleUserStatusRequest(
        context,
        authorizationResult.user.id,
        authorizationResult.user.role,
        userStatusActionPayload.action,
        userStatusActionPayload.targetTelegramUserId,
      );
      return;
    }

    if (dockerActionPayload) {
      await this.handleDockerActionRequest(
        context,
        authorizationResult.user.id,
        authorizationResult.user.role,
        dockerActionPayload.action,
        dockerActionPayload.containerShortId,
      );
      return;
    }

    if (deployRunTargetName) {
      await this.handleDeployRunRequest(
        context,
        authorizationResult.user.id,
        authorizationResult.user.role,
        deployRunTargetName,
      );
      return;
    }

    if (deployRollbackTargetName) {
      await this.handleDeployRollbackRequest(
        context,
        authorizationResult.user.id,
        authorizationResult.user.role,
        deployRollbackTargetName,
      );
      return;
    }

    if (!navigationCallback) {
      await context.answerCbQuery('Tác vụ không hợp lệ.', {
        show_alert: true,
      });
      return;
    }

    const requiredPermission = CALLBACK_PERMISSIONS[navigationCallback];

    if (
      requiredPermission &&
      !this.rbacService.hasPermission(
        authorizationResult.user.role,
        requiredPermission,
      )
    ) {
      await context.answerCbQuery(
        'Bạn không có quyền thực hiện thao tác này.',
        {
          show_alert: true,
        },
      );
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.callback',
        resourceType: 'telegram_callback',
        resourceId: navigationCallback,
        requestId: String(context.update.update_id ?? ''),
        payloadJson: {
          permission: requiredPermission,
        },
        result: AuditResult.DENIED,
      });
      return;
    }

    if (navigationCallback === TELEGRAM_CALLBACKS.dashboard) {
      const dashboardSnapshot =
        await this.dashboardService.getDashboardSnapshot(
          authorizationResult.user.role,
        );

      await context.answerCbQuery('Đang mở Dashboard...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.dashboard',
        resourceType: 'telegram_callback',
        resourceId: navigationCallback,
        requestId: String(context.update.update_id ?? ''),
        result: AuditResult.SUCCESS,
      });
      await this.menuRenderer.renderScreen(context, {
        text: [
          '📊 <b>Dashboard</b>',
          '',
          `Ứng dụng: <b>${dashboardSnapshot.appName}</b>`,
          `Môi trường: <b>${dashboardSnapshot.environment}</b>`,
          `Timezone: <b>${dashboardSnapshot.timezone}</b>`,
          `Host: <b>${dashboardSnapshot.hostname}</b>`,
          `CPU: <b>${formatPercent(dashboardSnapshot.cpuUsagePercent)}</b>`,
          `RAM: <b>${formatPercent(dashboardSnapshot.memoryUsagePercent)}</b>`,
          `Disk: <b>${formatPercent(dashboardSnapshot.diskUsagePercent)}</b>`,
          `Uptime: <b>${formatDuration(dashboardSnapshot.uptimeSeconds)}</b>`,
        ].join('\n'),
        keyboard:
          this.navigationService.buildFeaturePlaceholder('Dashboard').keyboard,
      });
      return;
    }

    if (navigationCallback === TELEGRAM_CALLBACKS.database) {
      const databaseSnapshot = await this.backupService.getDatabaseStatus();

      await context.answerCbQuery('Đang tải trạng thái database...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.database',
        resourceType: 'telegram_callback',
        resourceId: navigationCallback,
        requestId: String(context.update.update_id ?? ''),
        result: AuditResult.SUCCESS,
      });
      await this.menuRenderer.renderScreen(context, {
        text: [
          '🗄 <b>Database</b>',
          '',
          `Host: <b>${escapeHtml(databaseSnapshot.host)}</b>`,
          `Database: <b>${escapeHtml(databaseSnapshot.databaseName)}</b>`,
          databaseSnapshot.reachable
            ? 'Trạng thái: <b>🟢 Kết nối thành công</b>'
            : 'Trạng thái: <b>🔴 Không kết nối được</b>',
          ...(databaseSnapshot.error
            ? [`Lỗi: <code>${escapeHtml(databaseSnapshot.error)}</code>`]
            : []),
        ].join('\n'),
        keyboard:
          this.navigationService.buildFeaturePlaceholder('Database').keyboard,
      });
      return;
    }

    if (navigationCallback === TELEGRAM_CALLBACKS.deploy) {
      const deployOverview = await this.deployTargetsService.getOverview();

      await context.answerCbQuery('Đang tải deployment targets...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.deploy',
        resourceType: 'telegram_callback',
        resourceId: navigationCallback,
        requestId: String(context.update.update_id ?? ''),
        result: AuditResult.SUCCESS,
      });
      await this.menuRenderer.renderScreen(context, {
        text: [
          '🚀 <b>Deploy</b>',
          '',
          `File cấu hình: <code>${escapeHtml(deployOverview.configPath)}</code>`,
          `Trạng thái file: <b>${deployOverview.fileExists ? '🟢 Tìm thấy' : '🔴 Chưa có file'}</b>`,
          `Targets bật: <b>${deployOverview.enabledTargetCount}</b>`,
          `Targets tắt: <b>${deployOverview.disabledTargetCount}</b>`,
          '',
          ...(deployOverview.targets.length > 0
            ? deployOverview.targets.map(
                (target, index) =>
                  `${index + 1}. <b>${escapeHtml(target.displayName)}</b> | ${target.enabled ? 'enabled' : 'disabled'} | branch ${escapeHtml(target.branch)} | compose ${escapeHtml(target.composeProject)}`,
              )
            : ['Chưa có deployment target nào được cấu hình.']),
        ].join('\n'),
        keyboard: buildKeyboard(
          this.rbacService.hasPermission(
            authorizationResult.user.role,
            PERMISSIONS.deployRun,
          )
            ? deployOverview.targets
                .filter((target) => target.enabled)
                .flatMap((target) => [
                  {
                    text: `🚀 ${target.displayName}`,
                    callback_data: buildDeployRunCallback(target.name),
                  },
                  {
                    text: `↩️ Rollback ${target.displayName}`,
                    callback_data: buildDeployRollbackCallback(target.name),
                  },
                ])
            : [],
          [
            [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
            [{ text: '🔄 Làm mới', callback_data: TELEGRAM_CALLBACKS.refresh }],
          ],
        ),
      });
      return;
    }

    if (navigationCallback === TELEGRAM_CALLBACKS.backup) {
      const backupSnapshot = await this.backupService.getBackupOverview();

      await context.answerCbQuery('Đang tải trạng thái backup...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.backup',
        resourceType: 'telegram_callback',
        resourceId: navigationCallback,
        requestId: String(context.update.update_id ?? ''),
        result: AuditResult.SUCCESS,
      });
      await this.menuRenderer.renderScreen(context, {
        text: [
          '💾 <b>Backup</b>',
          '',
          `Bật backup DB: <b>${backupSnapshot.enabled ? 'Có' : 'Không'}</b>`,
          `Thư mục backup: <code>${escapeHtml(backupSnapshot.backupDirectory)}</code>`,
          `Truy cập thư mục: <b>${backupSnapshot.directoryAccessible ? '🟢 OK' : '🔴 Không khả dụng'}</b>`,
          `pg_dump: <b>${backupSnapshot.pgDumpAvailable ? '🟢 Sẵn sàng' : '🔴 Chưa tìm thấy'}</b>`,
          ...(backupSnapshot.pgDumpVersion
            ? [
                `Phiên bản pg_dump: <code>${escapeHtml(backupSnapshot.pgDumpVersion)}</code>`,
              ]
            : []),
          `Giới hạn gửi Telegram: <b>${backupSnapshot.maxTelegramSizeMb} MB</b>`,
          '',
          ...(backupSnapshot.latestBackup
            ? [
                'Lần backup gần nhất:',
                `File: <code>${escapeHtml(backupSnapshot.latestBackup.filename)}</code>`,
                `Trạng thái: <b>${backupSnapshot.latestBackup.status}</b>`,
                `Kích thước: <b>${formatBigIntBytes(backupSnapshot.latestBackup.sizeBytes)}</b>`,
                `Hoàn tất: <b>${backupSnapshot.latestBackup.finishedAt ? backupSnapshot.latestBackup.finishedAt.toISOString() : 'Chưa xong'}</b>`,
                ...(backupSnapshot.latestBackup.errorMessage
                  ? [
                      `Lỗi: <code>${escapeHtml(backupSnapshot.latestBackup.errorMessage)}</code>`,
                    ]
                  : []),
              ]
            : ['Chưa có bản ghi backup nào trong hệ thống.']),
        ].join('\n'),
        keyboard: buildKeyboard(
          this.rbacService.hasPermission(
            authorizationResult.user.role,
            PERMISSIONS.backupRun,
          )
            ? [
                ...(backupSnapshot.enabled
                  ? [
                      {
                        text: '💾 Tạo backup',
                        callback_data: buildBackupCreateCallback(),
                      },
                    ]
                  : []),
                {
                  text: '📦 Gửi backup gần nhất',
                  callback_data: buildBackupDownloadLatestCallback(),
                },
              ]
            : [],
          [
            [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
            [{ text: '🔄 Làm mới', callback_data: TELEGRAM_CALLBACKS.refresh }],
          ],
        ),
      });
      return;
    }

    if (navigationCallback === TELEGRAM_CALLBACKS.monitoring) {
      const monitoringSnapshot = await this.monitoringService.getOverview();
      const alertsSnapshot =
        await this.alertsService.evaluateTargets(monitoringSnapshot);

      await context.answerCbQuery('Đang tải monitoring...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.monitoring',
        resourceType: 'telegram_callback',
        resourceId: navigationCallback,
        requestId: String(context.update.update_id ?? ''),
        result: AuditResult.SUCCESS,
      });
      await this.menuRenderer.renderScreen(context, {
        text: [
          '📈 <b>Monitoring</b>',
          '',
          `File cấu hình: <code>${escapeHtml(monitoringSnapshot.configPath)}</code>`,
          `Trạng thái file: <b>${monitoringSnapshot.fileExists ? '🟢 Tìm thấy' : '🔴 Chưa có file'}</b>`,
          `Targets bật: <b>${monitoringSnapshot.enabledTargetCount}</b>`,
          `Targets tắt: <b>${monitoringSnapshot.disabledTargetCount}</b>`,
          `Healthy: <b>${monitoringSnapshot.healthyCount}</b>`,
          `Degraded: <b>${monitoringSnapshot.degradedCount}</b>`,
          `Down: <b>${monitoringSnapshot.downCount}</b>`,
          '',
          '<b>Alerts</b>',
          `File rules: <code>${escapeHtml(alertsSnapshot.configPath)}</code>`,
          `Rules bật: <b>${alertsSnapshot.enabledRuleCount}</b>`,
          `Rules tắt: <b>${alertsSnapshot.disabledRuleCount}</b>`,
          `Alerts đang mở: <b>${alertsSnapshot.activeAlertCount}</b>`,
          `Alerts vừa resolve: <b>${alertsSnapshot.resolvedAlertCount}</b>`,
          ...(alertsSnapshot.alerts.length > 0
            ? [
                '',
                ...alertsSnapshot.alerts.map(
                  (alert, index) =>
                    `${index + 1}. <b>${escapeHtml(alert.displayName)}</b> | ${alert.severity} | ${escapeHtml(alert.summary)} | notify ${alert.notificationState}`,
                ),
              ]
            : []),
          '',
          ...(monitoringSnapshot.targets.length > 0
            ? monitoringSnapshot.targets.map((target, index) =>
                [
                  `${index + 1}. <b>${escapeHtml(target.displayName)}</b> | ${formatMonitoringStatus(target.status)}`,
                  `${escapeHtml(target.method)} ${escapeHtml(target.url)}`,
                  target.responseTimeMs !== null
                    ? `${target.responseTimeMs}ms`
                    : 'chưa probe',
                  target.statusCode !== null
                    ? `HTTP ${target.statusCode}`
                    : null,
                  target.errorMessage ? escapeHtml(target.errorMessage) : null,
                ]
                  .filter((value) => value !== null)
                  .join(' | '),
              )
            : ['Chưa có health target nào được cấu hình.']),
        ].join('\n'),
        keyboard: buildKeyboard(
          [],
          [
            [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
            [{ text: '🔄 Làm mới', callback_data: TELEGRAM_CALLBACKS.refresh }],
          ],
        ),
      });
      return;
    }

    if (navigationCallback === TELEGRAM_CALLBACKS.docker) {
      try {
        const overview = await this.dockerService.getOverview();
        const actionTargets = await this.dockerService.getActionTargets();
        const canManageDocker = this.rbacService.hasPermission(
          authorizationResult.user.role,
          PERMISSIONS.dockerManage,
        );
        const dangerousActionsEnabled =
          this.dockerService.getDangerousActionsEnabled();

        await context.answerCbQuery('Đang tải Docker...');
        await this.auditService.record({
          actorUserId: authorizationResult.user.id,
          action: 'telegram.docker',
          resourceType: 'telegram_callback',
          resourceId: navigationCallback,
          requestId: String(context.update.update_id ?? ''),
          result: AuditResult.SUCCESS,
        });
        await this.menuRenderer.renderScreen(context, {
          text: [
            '🐳 <b>Docker</b>',
            '',
            overview.restricted
              ? 'Chỉ hiển thị container nằm trong allowlist.'
              : 'Đang hiển thị toàn bộ container hiện có.',
            '',
            ...(overview.containers.length > 0
              ? overview.containers.map(
                  (container, index) =>
                    `${index + 1}. <b>${escapeHtml(container.name)}</b> | ${escapeHtml(container.state)} | ${escapeHtml(container.status)}`,
                )
              : ['Không tìm thấy container phù hợp.']),
            '',
            dangerousActionsEnabled
              ? canManageDocker
                ? 'Có thể thao tác start/stop/restart sau bước xác nhận.'
                : 'Tài khoản hiện tại chỉ có quyền xem, không thể thao tác.'
              : 'Dangerous Docker actions đang bị tắt trong cấu hình.',
          ].join('\n'),
          keyboard: buildKeyboard(
            dangerousActionsEnabled && canManageDocker
              ? actionTargets.flatMap((target) =>
                  target.availableActions.map((action) => ({
                    text: `${getDockerActionEmoji(action)} ${target.name}`,
                    callback_data: buildDockerActionCallback(
                      action,
                      target.shortId,
                    ),
                  })),
                )
              : [],
            [
              [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
              [
                {
                  text: '🔄 Làm mới',
                  callback_data: TELEGRAM_CALLBACKS.refresh,
                },
              ],
            ],
          ),
        });
      } catch (error) {
        await context.answerCbQuery('Không thể kết nối Docker daemon.', {
          show_alert: true,
        });
        this.logUnhandledError(error);
      }
      return;
    }

    if (navigationCallback === TELEGRAM_CALLBACKS.logs) {
      try {
        const logsSnapshot = await this.dockerService.getRecentLogs();

        await context.answerCbQuery('Đang tải logs...');
        await this.auditService.record({
          actorUserId: authorizationResult.user.id,
          action: 'telegram.logs',
          resourceType: 'telegram_callback',
          resourceId: navigationCallback,
          requestId: String(context.update.update_id ?? ''),
          result: AuditResult.SUCCESS,
        });
        await this.menuRenderer.renderScreen(context, {
          text: logsSnapshot
            ? [
                '📄 <b>Logs gần nhất</b>',
                '',
                `Container: <b>${escapeHtml(logsSnapshot.containerName)}</b>`,
                '',
                '<pre>',
                escapeHtml(logsSnapshot.lines.join('\n')),
                '</pre>',
              ].join('\n')
            : [
                '📄 <b>Logs gần nhất</b>',
                '',
                'Chưa có container phù hợp để hiển thị log.',
              ].join('\n'),
          keyboard:
            this.navigationService.buildFeaturePlaceholder('Logs').keyboard,
        });
      } catch (error) {
        await context.answerCbQuery('Không thể đọc logs từ Docker daemon.', {
          show_alert: true,
        });
        this.logUnhandledError(error);
      }
      return;
    }

    if (navigationCallback === TELEGRAM_CALLBACKS.server) {
      const serverSnapshot = await this.serverService.getServerSnapshot();

      await context.answerCbQuery('Đang tải thông tin server...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.server',
        resourceType: 'telegram_callback',
        resourceId: navigationCallback,
        requestId: String(context.update.update_id ?? ''),
        result: AuditResult.SUCCESS,
      });
      await this.menuRenderer.renderScreen(context, {
        text: [
          '🖥 <b>Server</b>',
          '',
          `Host: <b>${escapeHtml(serverSnapshot.hostname)}</b>`,
          `Nền tảng: <b>${escapeHtml(serverSnapshot.platform)}</b>`,
          `Hệ điều hành: <b>${escapeHtml(`${serverSnapshot.distro} ${serverSnapshot.release}`)}</b>`,
          `Uptime: <b>${formatDuration(serverSnapshot.uptimeSeconds)}</b>`,
          `CPU hiện tại: <b>${formatPercent(serverSnapshot.cpuUsagePercent)}</b>`,
          `RAM: <b>${formatBytes(serverSnapshot.memoryUsedBytes)}</b> / <b>${formatBytes(serverSnapshot.memoryTotalBytes)}</b>`,
          `Disk: <b>${formatBytes(serverSnapshot.diskUsedBytes)}</b> / <b>${formatBytes(serverSnapshot.diskTotalBytes)}</b>`,
        ].join('\n'),
        keyboard:
          this.navigationService.buildFeaturePlaceholder('Server').keyboard,
      });
      return;
    }

    if (navigationCallback === TELEGRAM_CALLBACKS.users) {
      const users = await this.usersService.listUserSummaries();
      const canManageUsers = this.rbacService.hasPermission(
        authorizationResult.user.role,
        PERMISSIONS.usersManage,
      );

      await context.answerCbQuery('Đang tải danh sách người dùng...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.users',
        resourceType: 'telegram_callback',
        resourceId: navigationCallback,
        requestId: String(context.update.update_id ?? ''),
        result: AuditResult.SUCCESS,
      });
      await this.menuRenderer.renderScreen(context, {
        text: [
          '👥 <b>Người dùng</b>',
          '',
          ...(users.length > 0
            ? users.map(
                (user, index) =>
                  `${index + 1}. <b>${escapeHtml(user.displayName)}</b> | ${user.role} | ${user.status} | last seen: ${user.lastSeenAt ? user.lastSeenAt.toISOString() : 'never'}`,
              )
            : ['Chưa có người dùng nào trong hệ thống.']),
        ].join('\n'),
        keyboard: buildKeyboard(
          canManageUsers
            ? users.flatMap((user) => {
                if (user.role === UserRole.OWNER) {
                  return [];
                }

                if (user.status === UserStatus.ACTIVE) {
                  return [
                    {
                      text: `⛔ ${user.displayName}`,
                      callback_data: buildUserStatusActionCallback(
                        'disable',
                        user.telegramUserId,
                      ),
                    },
                  ];
                }

                return [
                  {
                    text: `✅ ${user.displayName}`,
                    callback_data: buildUserStatusActionCallback(
                      'activate',
                      user.telegramUserId,
                    ),
                  },
                ];
              })
            : [],
          [
            [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
            [{ text: '🔄 Làm mới', callback_data: TELEGRAM_CALLBACKS.refresh }],
          ],
        ),
      });
      return;
    }

    if (navigationCallback === TELEGRAM_CALLBACKS.settings) {
      const settingsSnapshot = await this.settingsService.getSettingsSnapshot();

      await context.answerCbQuery('Đang tải cấu hình...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.settings',
        resourceType: 'telegram_callback',
        resourceId: navigationCallback,
        requestId: String(context.update.update_id ?? ''),
        result: AuditResult.SUCCESS,
      });
      await this.menuRenderer.renderScreen(context, {
        text: [
          '⚙️ <b>Settings</b>',
          '',
          `App: <b>${escapeHtml(settingsSnapshot.appName)}</b>`,
          `Môi trường: <b>${escapeHtml(settingsSnapshot.environment)}</b>`,
          `Timezone: <b>${escapeHtml(settingsSnapshot.timezone)}</b>`,
          `Dangerous actions: <b>${settingsSnapshot.dangerousActionsEnabled ? 'Bật' : 'Tắt'}</b>`,
          `Confirmation TTL: <b>${settingsSnapshot.confirmationTtlSeconds}s</b>`,
          `Rate limit: <b>${settingsSnapshot.actionRateLimitPerMinute}/phút</b>`,
          `Encryption key: <b>${settingsSnapshot.encryptionKeyConfigured ? 'Đã cấu hình' : 'Chưa cấu hình'}</b>`,
          `Allowlist containers: <b>${settingsSnapshot.containerAllowlistCount}</b>`,
          `Allowlist compose projects: <b>${settingsSnapshot.composeAllowlistCount}</b>`,
          `Backup directory: <code>${escapeHtml(settingsSnapshot.backupDirectory)}</code>`,
          `Persisted settings: <b>${settingsSnapshot.persistedSettingCount}</b>`,
        ].join('\n'),
        keyboard:
          this.navigationService.buildFeaturePlaceholder('Settings').keyboard,
      });
      return;
    }

    if (navigationCallback === TELEGRAM_CALLBACKS.audit) {
      const entries = await this.auditService.listRecent();

      await context.answerCbQuery('Đang tải audit log...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.audit',
        resourceType: 'telegram_callback',
        resourceId: navigationCallback,
        requestId: String(context.update.update_id ?? ''),
        result: AuditResult.SUCCESS,
      });
      await this.menuRenderer.renderScreen(context, {
        text: [
          '🧾 <b>Audit</b>',
          '',
          ...(entries.length > 0
            ? entries.map(
                (entry, index) =>
                  `${index + 1}. <b>${escapeHtml(entry.action)}</b> | ${entry.result} | ${escapeHtml(entry.resourceType)} | ${entry.actorDisplayName ? escapeHtml(entry.actorDisplayName) : 'system'} | ${entry.createdAt.toISOString()}`,
              )
            : ['Chưa có bản ghi audit nào.']),
        ].join('\n'),
        keyboard:
          this.navigationService.buildFeaturePlaceholder('Audit').keyboard,
      });
      return;
    }

    await context.answerCbQuery('Tính năng đang được triển khai.');
    await this.auditService.record({
      actorUserId: authorizationResult.user.id,
      action: 'telegram.callback',
      resourceType: 'telegram_callback',
      resourceId: navigationCallback,
      requestId: String(context.update.update_id ?? ''),
      payloadJson: {
        role: authorizationResult.user.role,
      },
      result: AuditResult.SUCCESS,
    });
    await this.menuRenderer.renderScreen(
      context,
      this.navigationService.buildFeaturePlaceholder(
        FEATURE_LABELS[navigationCallback],
      ),
    );
  }

  logUnhandledError(error: unknown): void {
    this.logger.error({ err: error }, 'Telegram update processing failed.');
  }

  private async handleDockerActionRequest(
    context: TelegramBotContext,
    actorUserId: string,
    role: UserRole,
    action: 'start' | 'stop' | 'restart',
    containerShortId: string,
  ): Promise<void> {
    if (!this.rbacService.hasPermission(role, PERMISSIONS.dockerManage)) {
      await context.answerCbQuery(
        'Bạn không có quyền thực hiện thao tác này.',
        {
          show_alert: true,
        },
      );
      return;
    }

    if (!this.dockerService.getDangerousActionsEnabled()) {
      await context.answerCbQuery(
        'Dangerous Docker actions đang bị tắt trong cấu hình.',
        {
          show_alert: true,
        },
      );
      return;
    }

    const target = await this.dockerService.findActionTarget(containerShortId);
    const actionRequest = await this.actionRequestService.createPendingRequest({
      actorUserId,
      actionType: `docker.${action}`,
      resourceType: 'docker_container',
      resourceId: containerShortId,
      payloadJson: {
        containerName: target.name,
        state: target.state,
      },
    });

    await this.auditService.record({
      actorUserId,
      action: 'telegram.docker.request',
      resourceType: 'docker_container',
      resourceId: target.name,
      payloadJson: {
        action,
        token: actionRequest.token,
      },
      result: AuditResult.STARTED,
    });
    await context.answerCbQuery('Cần xác nhận thao tác Docker.');
    await this.menuRenderer.renderScreen(context, {
      text: [
        '⚠️ <b>Xác nhận thao tác Docker</b>',
        '',
        `Container: <b>${escapeHtml(target.name)}</b>`,
        `Hành động: <b>${action}</b>`,
        'Bạn cần xác nhận trong thời gian hiệu lực trước khi TeleOps thực thi.',
      ].join('\n'),
      keyboard: buildKeyboard(
        [],
        [
          [
            {
              text: '✅ Xác nhận',
              callback_data: buildActionConfirmCallback(actionRequest.token),
            },
            {
              text: '❌ Hủy',
              callback_data: buildActionCancelCallback(actionRequest.token),
            },
          ],
          [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
        ],
      ),
    });
  }

  private async handleBackupCreateRequest(
    context: TelegramBotContext,
    actorUserId: string,
    role: UserRole,
  ): Promise<void> {
    if (!this.rbacService.hasPermission(role, PERMISSIONS.backupRun)) {
      await context.answerCbQuery(
        'Bạn không có quyền thực hiện thao tác này.',
        {
          show_alert: true,
        },
      );
      return;
    }

    const actionRequest = await this.actionRequestService.createPendingRequest({
      actorUserId,
      actionType: 'backup.create',
      resourceType: 'postgres_backup',
    });

    await this.auditService.record({
      actorUserId,
      action: 'telegram.backup.request',
      resourceType: 'postgres_backup',
      payloadJson: {
        token: actionRequest.token,
      },
      result: AuditResult.STARTED,
    });
    await context.answerCbQuery('Cần xác nhận tạo backup.');
    await this.menuRenderer.renderScreen(context, {
      text: [
        '⚠️ <b>Xác nhận tạo backup</b>',
        '',
        'TeleOps sẽ chạy pg_dump và lưu bản sao vào thư mục backup đã cấu hình.',
      ].join('\n'),
      keyboard: buildKeyboard(
        [],
        [
          [
            {
              text: '✅ Xác nhận',
              callback_data: buildActionConfirmCallback(actionRequest.token),
            },
            {
              text: '❌ Hủy',
              callback_data: buildActionCancelCallback(actionRequest.token),
            },
          ],
          [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
        ],
      ),
    });
  }

  private async handleLatestBackupDeliveryRequest(
    context: TelegramBotContext,
    actorUserId: string,
    role: UserRole,
  ): Promise<void> {
    if (!this.rbacService.hasPermission(role, PERMISSIONS.backupRun)) {
      await context.answerCbQuery(
        'Bạn không có quyền thực hiện thao tác này.',
        {
          show_alert: true,
        },
      );
      return;
    }

    let backupArtifact: BackupArtifactResult;

    try {
      backupArtifact =
        await this.backupService.getLatestSuccessfulBackupArtifactForTelegram();
    } catch (error) {
      await context.answerCbQuery(
        error instanceof Error
          ? error.message
          : 'Không thể gửi backup gần nhất.',
        {
          show_alert: true,
        },
      );
      return;
    }

    await context.answerCbQuery('Đang gửi backup gần nhất...');
    const delivered = await this.sendBackupArtifact(
      context,
      backupArtifact,
      '📦 Backup gần nhất',
      '⚠️ TeleOps đã tìm thấy backup nhưng chưa gửi được file vào Telegram.',
    );

    await this.auditService.record({
      actorUserId,
      action: 'telegram.backup.download_latest',
      resourceType: 'postgres_backup',
      resourceId: backupArtifact.filename,
      payloadJson: {
        checksumSha256: backupArtifact.checksumSha256,
        sizeBytes: backupArtifact.sizeBytes.toString(),
      },
      result: delivered ? AuditResult.SUCCESS : AuditResult.FAILED,
    });
  }

  private async handleUserStatusRequest(
    context: TelegramBotContext,
    actorUserId: string,
    role: UserRole,
    action: 'activate' | 'disable',
    targetTelegramUserId: string,
  ): Promise<void> {
    if (!this.rbacService.hasPermission(role, PERMISSIONS.usersManage)) {
      await context.answerCbQuery(
        'Bạn không có quyền thực hiện thao tác này.',
        {
          show_alert: true,
        },
      );
      return;
    }

    const targetUser =
      await this.usersService.findByTelegramUserId(targetTelegramUserId);

    if (!targetUser) {
      await context.answerCbQuery('Không tìm thấy người dùng cần cập nhật.', {
        show_alert: true,
      });
      return;
    }

    if (targetUser.role === UserRole.OWNER && action === 'disable') {
      await context.answerCbQuery('Không thể vô hiệu hóa owner.', {
        show_alert: true,
      });
      return;
    }

    const targetStatus =
      action === 'activate' ? UserStatus.ACTIVE : UserStatus.DISABLED;

    if (targetUser.status === targetStatus) {
      await context.answerCbQuery('Người dùng đã ở trạng thái mong muốn.', {
        show_alert: true,
      });
      return;
    }

    const actionRequest = await this.actionRequestService.createPendingRequest({
      actorUserId,
      actionType: action === 'activate' ? 'user.activate' : 'user.disable',
      resourceType: 'user',
      resourceId: targetUser.id,
      payloadJson: {
        displayName: targetUser.displayName,
        telegramUserId: targetUser.telegramUserId,
        currentStatus: targetUser.status,
        targetStatus,
      },
    });

    await this.auditService.record({
      actorUserId,
      action: 'telegram.users.request',
      resourceType: 'user',
      resourceId: targetUser.id,
      payloadJson: {
        currentStatus: targetUser.status,
        targetStatus,
        token: actionRequest.token,
      },
      result: AuditResult.STARTED,
    });
    await context.answerCbQuery('Cần xác nhận cập nhật người dùng.');
    await this.menuRenderer.renderScreen(context, {
      text: [
        '⚠️ <b>Xác nhận cập nhật người dùng</b>',
        '',
        `Người dùng: <b>${escapeHtml(targetUser.displayName)}</b>`,
        `Telegram ID: <code>${escapeHtml(targetUser.telegramUserId)}</code>`,
        `Trạng thái hiện tại: <b>${targetUser.status}</b>`,
        `Trạng thái mới: <b>${targetStatus}</b>`,
      ].join('\n'),
      keyboard: buildKeyboard(
        [],
        [
          [
            {
              text: '✅ Xác nhận',
              callback_data: buildActionConfirmCallback(actionRequest.token),
            },
            {
              text: '❌ Hủy',
              callback_data: buildActionCancelCallback(actionRequest.token),
            },
          ],
          [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
        ],
      ),
    });
  }

  private async handleDeployRunRequest(
    context: TelegramBotContext,
    actorUserId: string,
    role: UserRole,
    targetName: string,
  ): Promise<void> {
    if (!this.rbacService.hasPermission(role, PERMISSIONS.deployRun)) {
      await context.answerCbQuery(
        'Bạn không có quyền thực hiện thao tác này.',
        {
          show_alert: true,
        },
      );
      return;
    }

    const target =
      await this.deployTargetsService.getEnabledTargetByName(targetName);
    const actionRequest = await this.actionRequestService.createPendingRequest({
      actorUserId,
      actionType: 'deploy.run',
      resourceType: 'deployment_target',
      resourceId: target.name,
      payloadJson: {
        displayName: target.displayName,
        branch: target.branch,
        composeProject: target.composeProject,
      },
    });

    await this.auditService.record({
      actorUserId,
      action: 'telegram.deploy.request',
      resourceType: 'deployment_target',
      resourceId: target.name,
      payloadJson: {
        branch: target.branch,
        composeProject: target.composeProject,
        token: actionRequest.token,
      },
      result: AuditResult.STARTED,
    });
    await context.answerCbQuery('Cần xác nhận chạy deployment.');
    await this.menuRenderer.renderScreen(context, {
      text: [
        '⚠️ <b>Xác nhận deployment</b>',
        '',
        `Target: <b>${escapeHtml(target.displayName)}</b>`,
        `Branch: <b>${escapeHtml(target.branch)}</b>`,
        `Compose project: <b>${escapeHtml(target.composeProject)}</b>`,
        'TeleOps sẽ pull branch đích và chạy docker compose up -d --build.',
      ].join('\n'),
      keyboard: buildKeyboard(
        [],
        [
          [
            {
              text: '✅ Xác nhận',
              callback_data: buildActionConfirmCallback(actionRequest.token),
            },
            {
              text: '❌ Hủy',
              callback_data: buildActionCancelCallback(actionRequest.token),
            },
          ],
          [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
        ],
      ),
    });
  }

  private async handleDeployRollbackRequest(
    context: TelegramBotContext,
    actorUserId: string,
    role: UserRole,
    targetName: string,
  ): Promise<void> {
    if (!this.rbacService.hasPermission(role, PERMISSIONS.deployRun)) {
      await context.answerCbQuery(
        'Bạn không có quyền thực hiện thao tác này.',
        {
          show_alert: true,
        },
      );
      return;
    }

    let rollbackPreview: DeploymentRollbackPreview;

    try {
      rollbackPreview =
        await this.deploymentService.getRollbackPreview(targetName);
    } catch (error) {
      await context.answerCbQuery(
        error instanceof Error
          ? `Không thể chuẩn bị rollback: ${error.message}`
          : 'Không thể chuẩn bị rollback.',
        {
          show_alert: true,
        },
      );
      return;
    }

    const target =
      await this.deployTargetsService.getEnabledTargetByName(targetName);
    const actionRequest = await this.actionRequestService.createPendingRequest({
      actorUserId,
      actionType: 'deploy.rollback',
      resourceType: 'deployment_target',
      resourceId: target.name,
      payloadJson: {
        displayName: target.displayName,
        branch: target.branch,
        composeProject: target.composeProject,
        currentCommit: rollbackPreview.currentCommit,
        rollbackCommit: rollbackPreview.rollbackCommit,
      },
    });

    await this.auditService.record({
      actorUserId,
      action: 'telegram.deploy.rollback.request',
      resourceType: 'deployment_target',
      resourceId: target.name,
      payloadJson: {
        branch: target.branch,
        composeProject: target.composeProject,
        currentCommit: rollbackPreview.currentCommit,
        rollbackCommit: rollbackPreview.rollbackCommit,
        token: actionRequest.token,
      },
      result: AuditResult.STARTED,
    });
    await context.answerCbQuery('Cần xác nhận rollback deployment.');
    await this.menuRenderer.renderScreen(context, {
      text: [
        '⚠️ <b>Xác nhận rollback deployment</b>',
        '',
        `Target: <b>${escapeHtml(target.displayName)}</b>`,
        `Branch: <b>${escapeHtml(target.branch)}</b>`,
        `Compose project: <b>${escapeHtml(target.composeProject)}</b>`,
        `Commit hiện tại: <code>${escapeHtml(rollbackPreview.currentCommit)}</code>`,
        `Commit sẽ rollback tới: <code>${escapeHtml(rollbackPreview.rollbackCommit)}</code>`,
        'TeleOps sẽ checkout commit trước đó, chạy docker compose up -d --build, và kiểm tra health target nếu có.',
      ].join('\n'),
      keyboard: buildKeyboard(
        [],
        [
          [
            {
              text: '✅ Xác nhận',
              callback_data: buildActionConfirmCallback(actionRequest.token),
            },
            {
              text: '❌ Hủy',
              callback_data: buildActionCancelCallback(actionRequest.token),
            },
          ],
          [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
        ],
      ),
    });
  }

  private async handleConfirmationCallback(
    context: TelegramBotContext,
    actorUserId: string,
    role: UserRole,
    token: string,
  ): Promise<void> {
    const resolution = await this.actionRequestService.resolveForActor(
      token,
      actorUserId,
    );

    if (resolution.status !== 'ready') {
      await context.answerCbQuery(
        mapActionResolutionMessage(resolution.status),
        {
          show_alert: true,
        },
      );
      return;
    }

    const requiredPermission = getPermissionForActionType(
      resolution.request.actionType,
    );

    if (
      requiredPermission &&
      !this.rbacService.hasPermission(role, requiredPermission)
    ) {
      await context.answerCbQuery(
        'Bạn không có quyền thực hiện thao tác này.',
        {
          show_alert: true,
        },
      );
      return;
    }

    try {
      await this.actionRequestService.markConfirmed(resolution.request.id);

      const dockerAction = parseDockerManagedAction(
        resolution.request.actionType,
      );

      if (dockerAction && resolution.request.resourceId) {
        const executedTarget = await this.dockerService.executeAction(
          resolution.request.resourceId,
          dockerAction,
        );

        await this.actionRequestService.markExecuted(resolution.request.id);
        await this.auditService.record({
          actorUserId,
          action: `telegram.${dockerAction}`,
          resourceType: 'docker_container',
          resourceId: executedTarget.name,
          payloadJson: {
            containerShortId: executedTarget.shortId,
          },
          result: AuditResult.SUCCESS,
        });
        await context.answerCbQuery('Đã xác nhận và thực thi thao tác.');
        await this.menuRenderer.renderScreen(
          context,
          buildDockerSuccessScreen(dockerAction, executedTarget.name),
        );
        return;
      }

      if (resolution.request.actionType === 'backup.create') {
        const backupResult = await this.backupService.createBackup(actorUserId);
        const deliveryDecision = this.backupService.getTelegramDeliveryDecision(
          backupResult.sizeBytes,
        );

        await this.actionRequestService.markExecuted(resolution.request.id);
        await this.auditService.record({
          actorUserId,
          action: 'telegram.backup.execute',
          resourceType: 'postgres_backup',
          resourceId: backupResult.filename,
          payloadJson: {
            checksumSha256: backupResult.checksumSha256,
            sizeBytes: backupResult.sizeBytes.toString(),
          },
          result: AuditResult.SUCCESS,
        });
        await context.answerCbQuery('Đã tạo backup thành công.');
        await this.menuRenderer.renderScreen(
          context,
          buildBackupSuccessScreen(backupResult, deliveryDecision),
        );
        await this.sendBackupArtifactIfEligible(
          context,
          backupResult,
          deliveryDecision,
        );
        return;
      }

      const targetUserStatus = parseUserTargetStatus(
        resolution.request.actionType,
      );

      if (targetUserStatus && resolution.request.resourceId) {
        const updatedUser = await this.usersService.updateUserStatus(
          resolution.request.resourceId,
          targetUserStatus,
        );

        await this.actionRequestService.markExecuted(resolution.request.id);
        await this.auditService.record({
          actorUserId,
          action: 'telegram.users.execute',
          resourceType: 'user',
          resourceId: updatedUser.id,
          payloadJson: {
            telegramUserId: updatedUser.telegramUserId,
            status: updatedUser.status,
          },
          result: AuditResult.SUCCESS,
        });
        await context.answerCbQuery('Đã cập nhật trạng thái người dùng.');
        await this.menuRenderer.renderScreen(
          context,
          buildUserStatusSuccessScreen(updatedUser),
        );
        return;
      }

      if (
        resolution.request.actionType === 'deploy.run' &&
        resolution.request.resourceId
      ) {
        const deploymentResult = await this.deploymentService.runDeployment(
          resolution.request.resourceId,
          actorUserId,
        );

        await this.actionRequestService.markExecuted(resolution.request.id);
        await this.auditService.record({
          actorUserId,
          action: 'telegram.deploy.execute',
          resourceType: 'deployment_target',
          resourceId: resolution.request.resourceId,
          payloadJson: {
            previousCommit: deploymentResult.previousCommit,
            deployedCommit: deploymentResult.deployedCommit,
          },
          result: AuditResult.SUCCESS,
        });
        await context.answerCbQuery('Đã chạy deployment thành công.');
        await this.menuRenderer.renderScreen(
          context,
          buildDeploySuccessScreen(deploymentResult),
        );
        return;
      }

      if (
        resolution.request.actionType === 'deploy.rollback' &&
        resolution.request.resourceId
      ) {
        const rollbackResult = await this.deploymentService.rollbackDeployment(
          resolution.request.resourceId,
          actorUserId,
        );

        await this.actionRequestService.markExecuted(resolution.request.id);
        await this.auditService.record({
          actorUserId,
          action: 'telegram.deploy.rollback.execute',
          resourceType: 'deployment_target',
          resourceId: resolution.request.resourceId,
          payloadJson: {
            previousCommit: rollbackResult.previousCommit,
            rolledBackToCommit: rollbackResult.rolledBackToCommit,
          },
          result: AuditResult.SUCCESS,
        });
        await context.answerCbQuery('Đã rollback deployment thành công.');
        await this.menuRenderer.renderScreen(
          context,
          buildRollbackSuccessScreen(rollbackResult),
        );
        return;
      }

      throw new Error('Confirmation payload is invalid.');
    } catch (error) {
      await this.actionRequestService.markFailed(resolution.request.id);
      const failureAuditEntry: {
        actorUserId: string;
        action: string;
        resourceType: string;
        errorMessage: string;
        result: AuditResult;
        resourceId?: string;
      } = {
        actorUserId,
        action: 'telegram.action.confirm',
        resourceType: resolution.request.resourceType,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        result: AuditResult.FAILED,
      };

      if (resolution.request.resourceId) {
        failureAuditEntry.resourceId = resolution.request.resourceId;
      }

      await this.auditService.record(failureAuditEntry);
      await context.answerCbQuery('Không thể thực thi thao tác đã xác nhận.', {
        show_alert: true,
      });
    }
  }

  private async handleCancellationCallback(
    context: TelegramBotContext,
    actorUserId: string,
    role: UserRole,
    token: string,
  ): Promise<void> {
    const resolution = await this.actionRequestService.resolveForActor(
      token,
      actorUserId,
    );

    if (resolution.status !== 'ready') {
      await context.answerCbQuery(
        mapActionResolutionMessage(resolution.status),
        {
          show_alert: true,
        },
      );
      return;
    }

    const requiredPermission = getPermissionForActionType(
      resolution.request.actionType,
    );

    if (
      requiredPermission &&
      !this.rbacService.hasPermission(role, requiredPermission)
    ) {
      await context.answerCbQuery(
        'Bạn không có quyền thực hiện thao tác này.',
        {
          show_alert: true,
        },
      );
      return;
    }

    await this.actionRequestService.markCancelled(resolution.request.id);
    const cancelledAuditEntry: {
      actorUserId: string;
      action: string;
      resourceType: string;
      result: AuditResult;
      resourceId?: string;
    } = {
      actorUserId,
      action: 'telegram.action.cancel',
      resourceType: resolution.request.resourceType,
      result: AuditResult.CANCELLED,
    };

    if (resolution.request.resourceId) {
      cancelledAuditEntry.resourceId = resolution.request.resourceId;
    }

    await this.auditService.record(cancelledAuditEntry);
    await context.answerCbQuery('Đã hủy thao tác.');
    await this.menuRenderer.renderScreen(
      context,
      buildCancelledScreen(resolution.request.actionType),
    );
  }

  private isNavigationCallback(value: string): value is TelegramCallback {
    return Object.values(TELEGRAM_CALLBACKS).includes(
      value as TelegramCallback,
    );
  }

  private async sendBackupArtifactIfEligible(
    context: TelegramBotContext,
    backupResult: BackupExecutionResult,
    deliveryDecision: {
      eligible: boolean;
      maxTelegramSizeMb: number;
    },
  ): Promise<void> {
    if (!deliveryDecision.eligible) {
      await context.reply(
        `📦 Backup đã được tạo nhưng không gửi tự động vì vượt giới hạn ${deliveryDecision.maxTelegramSizeMb} MB của Telegram.`,
        {
          parse_mode: 'HTML',
        },
      );
      return;
    }

    await this.sendBackupArtifact(
      context,
      backupResult,
      '💾 Backup',
      '⚠️ Backup đã tạo thành công nhưng TeleOps chưa gửi được file vào Telegram.',
    );
  }

  private async sendBackupArtifact(
    context: TelegramBotContext,
    backupArtifact: {
      filename: string;
      storagePath: string;
    },
    captionPrefix: string,
    failureMessage: string,
  ): Promise<boolean> {
    try {
      await context.replyWithDocument(
        Input.fromLocalFile(
          backupArtifact.storagePath,
          backupArtifact.filename,
        ),
        {
          caption: `${captionPrefix}: <code>${escapeHtml(backupArtifact.filename)}</code>`,
          parse_mode: 'HTML',
        },
      );
      return true;
    } catch (error) {
      this.logger.warn(
        { err: error, backupFilename: backupArtifact.filename },
        'Backup artifact delivery to Telegram failed.',
      );
      await context.reply(failureMessage, {
        parse_mode: 'HTML',
      });
      return false;
    }
  }
}

function buildDockerSuccessScreen(
  action: 'start' | 'stop' | 'restart',
  containerName: string,
): {
  text: string;
  keyboard: ReturnType<typeof buildKeyboard>;
} {
  return {
    text: [
      '✅ <b>Thao tác Docker thành công</b>',
      '',
      `Container: <b>${escapeHtml(containerName)}</b>`,
      `Hành động: <b>${action}</b>`,
    ].join('\n'),
    keyboard: buildKeyboard(
      [],
      [
        [{ text: '🐳 Docker', callback_data: TELEGRAM_CALLBACKS.docker }],
        [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
      ],
    ),
  };
}

function buildBackupSuccessScreen(
  backupResult: BackupExecutionResult,
  deliveryDecision: {
    eligible: boolean;
    maxTelegramSizeMb: number;
  },
): {
  text: string;
  keyboard: ReturnType<typeof buildKeyboard>;
} {
  return {
    text: [
      '✅ <b>Tạo backup thành công</b>',
      '',
      `File: <code>${escapeHtml(backupResult.filename)}</code>`,
      `Kích thước: <b>${formatBigIntBytes(backupResult.sizeBytes)}</b>`,
      `SHA-256: <code>${escapeHtml(backupResult.checksumSha256)}</code>`,
      deliveryDecision.eligible
        ? 'Telegram: <b>Sẽ gửi file backup ở tin nhắn kế tiếp</b>'
        : `Telegram: <b>Không gửi tự động, vượt giới hạn ${deliveryDecision.maxTelegramSizeMb} MB</b>`,
    ].join('\n'),
    keyboard: buildKeyboard(
      [],
      [
        [{ text: '💾 Backup', callback_data: TELEGRAM_CALLBACKS.backup }],
        [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
      ],
    ),
  };
}

function buildDeploySuccessScreen(
  deploymentResult: DeploymentExecutionResult,
): {
  text: string;
  keyboard: ReturnType<typeof buildKeyboard>;
} {
  return {
    text: [
      '✅ <b>Deployment thành công</b>',
      '',
      `Target: <b>${escapeHtml(deploymentResult.targetName)}</b>`,
      `Commit cũ: <code>${escapeHtml(deploymentResult.previousCommit)}</code>`,
      `Commit mới: <code>${escapeHtml(deploymentResult.deployedCommit)}</code>`,
      ...(deploymentResult.outputSummary
        ? [
            '',
            '<b>Tổng kết output</b>',
            `<code>${escapeHtml(deploymentResult.outputSummary)}</code>`,
          ]
        : []),
    ].join('\n'),
    keyboard: buildKeyboard(
      [],
      [
        [{ text: '🚀 Deploy', callback_data: TELEGRAM_CALLBACKS.deploy }],
        [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
      ],
    ),
  };
}

function buildRollbackSuccessScreen(rollbackResult: DeploymentRollbackResult): {
  text: string;
  keyboard: ReturnType<typeof buildKeyboard>;
} {
  return {
    text: [
      '✅ <b>Rollback deployment thành công</b>',
      '',
      `Target: <b>${escapeHtml(rollbackResult.targetName)}</b>`,
      `Commit trước rollback: <code>${escapeHtml(rollbackResult.previousCommit)}</code>`,
      `Commit đã khôi phục: <code>${escapeHtml(rollbackResult.rolledBackToCommit)}</code>`,
      ...(rollbackResult.outputSummary
        ? [
            '',
            '<b>Tổng kết output</b>',
            `<code>${escapeHtml(rollbackResult.outputSummary)}</code>`,
          ]
        : []),
    ].join('\n'),
    keyboard: buildKeyboard(
      [],
      [
        [{ text: '🚀 Deploy', callback_data: TELEGRAM_CALLBACKS.deploy }],
        [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
      ],
    ),
  };
}

function buildUserStatusSuccessScreen(user: {
  displayName: string;
  role: UserRole;
  status: UserStatus;
  telegramUserId: string;
}): {
  text: string;
  keyboard: ReturnType<typeof buildKeyboard>;
} {
  return {
    text: [
      '✅ <b>Cập nhật người dùng thành công</b>',
      '',
      `Người dùng: <b>${escapeHtml(user.displayName)}</b>`,
      `Telegram ID: <code>${escapeHtml(user.telegramUserId)}</code>`,
      `Role: <b>${user.role}</b>`,
      `Trạng thái mới: <b>${user.status}</b>`,
    ].join('\n'),
    keyboard: buildKeyboard(
      [],
      [
        [{ text: '👥 Users', callback_data: TELEGRAM_CALLBACKS.users }],
        [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
      ],
    ),
  };
}

function buildCancelledScreen(actionType: string): {
  text: string;
  keyboard: ReturnType<typeof buildKeyboard>;
} {
  if (actionType.startsWith('deploy.')) {
    return {
      text: [
        '❌ <b>Đã hủy thao tác</b>',
        '',
        'Không có thay đổi nào được áp dụng.',
      ].join('\n'),
      keyboard: buildKeyboard(
        [],
        [
          [{ text: '🚀 Deploy', callback_data: TELEGRAM_CALLBACKS.deploy }],
          [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
        ],
      ),
    };
  }

  if (actionType.startsWith('user.')) {
    return {
      text: [
        '❌ <b>Đã hủy thao tác</b>',
        '',
        'Không có thay đổi nào được áp dụng.',
      ].join('\n'),
      keyboard: buildKeyboard(
        [],
        [
          [{ text: '👥 Users', callback_data: TELEGRAM_CALLBACKS.users }],
          [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
        ],
      ),
    };
  }

  const destinationCallback =
    actionType === 'backup.create'
      ? TELEGRAM_CALLBACKS.backup
      : TELEGRAM_CALLBACKS.docker;
  const destinationLabel =
    actionType === 'backup.create' ? '💾 Backup' : '🐳 Docker';

  return {
    text: [
      '❌ <b>Đã hủy thao tác</b>',
      '',
      'Không có thay đổi nào được áp dụng.',
    ].join('\n'),
    keyboard: buildKeyboard(
      [],
      [
        [{ text: destinationLabel, callback_data: destinationCallback }],
        [{ text: '🏠 Home', callback_data: TELEGRAM_CALLBACKS.home }],
      ],
    ),
  };
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatBytes(value: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let currentValue = value;
  let unitIndex = 0;

  while (currentValue >= 1024 && unitIndex < units.length - 1) {
    currentValue /= 1024;
    unitIndex += 1;
  }

  return `${currentValue.toFixed(1)} ${units[unitIndex]}`;
}

function formatBigIntBytes(value: bigint | null): string {
  if (value === null) {
    return 'Không rõ';
  }

  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return `${value.toString()} B`;
  }

  return formatBytes(Number(value));
}

function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function escapeHtml(value: string): string {
  return value.replace(/[<&>]/g, (currentCharacter) => {
    switch (currentCharacter) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      default:
        return '&amp;';
    }
  });
}

function mapActionResolutionMessage(
  status: 'not_found' | 'wrong_actor' | 'already_used' | 'expired',
): string {
  switch (status) {
    case 'not_found':
      return 'Không tìm thấy yêu cầu xác nhận.';
    case 'wrong_actor':
      return 'Yêu cầu xác nhận này không thuộc về bạn.';
    case 'already_used':
      return 'Yêu cầu xác nhận này đã được xử lý trước đó.';
    case 'expired':
      return 'Yêu cầu xác nhận đã hết hạn.';
  }
}

function parseDockerManagedAction(
  actionType: string,
): 'start' | 'stop' | 'restart' | null {
  const match = actionType.match(/^docker\.(start|stop|restart)$/);
  return (match?.[1] as 'start' | 'stop' | 'restart' | undefined) ?? null;
}

function getPermissionForActionType(actionType: string): Permission | null {
  if (actionType.startsWith('docker.')) {
    return PERMISSIONS.dockerManage;
  }

  if (actionType === 'backup.create') {
    return PERMISSIONS.backupRun;
  }

  if (actionType.startsWith('user.')) {
    return PERMISSIONS.usersManage;
  }

  if (actionType === 'deploy.run' || actionType === 'deploy.rollback') {
    return PERMISSIONS.deployRun;
  }

  return null;
}

function formatMonitoringStatus(
  status: 'DISABLED' | 'HEALTHY' | 'DEGRADED' | 'DOWN',
): string {
  switch (status) {
    case 'HEALTHY':
      return '🟢 healthy';
    case 'DEGRADED':
      return '🟡 degraded';
    case 'DOWN':
      return '🔴 down';
    case 'DISABLED':
      return '⚪ disabled';
  }
}

function getDockerActionEmoji(action: 'start' | 'stop' | 'restart'): string {
  switch (action) {
    case 'start':
      return '▶️';
    case 'stop':
      return '⏹';
    case 'restart':
      return '🔄';
  }
}

function parseUserTargetStatus(actionType: string): UserStatus | null {
  if (actionType === 'user.activate') {
    return UserStatus.ACTIVE;
  }

  if (actionType === 'user.disable') {
    return UserStatus.DISABLED;
  }

  return null;
}
