import { AuditResult } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { TelegramRateLimitService } from 'src/common/rate-limit/telegram-rate-limit.service';
import { AuthService } from 'src/modules/auth/auth.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { BackupService } from 'src/modules/backup/backup.service';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import { DockerService } from 'src/modules/docker/docker.service';
import { PERMISSIONS, Permission } from 'src/modules/rbac/permissions';
import { RbacService } from 'src/modules/rbac/rbac.service';
import { ServerService } from 'src/modules/server/server.service';
import {
  TELEGRAM_CALLBACKS,
  TelegramCallback,
} from './callbacks/callback-data';
import { TelegramBotContext } from './context/telegram-context';
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
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly rbacService: RbacService,
    private readonly rateLimitService: TelegramRateLimitService,
    private readonly backupService: BackupService,
    private readonly dashboardService: DashboardService,
    private readonly dockerService: DockerService,
    private readonly serverService: ServerService,
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

    if (!this.isNavigationCallback(callbackData)) {
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

    if (
      callbackData === TELEGRAM_CALLBACKS.home ||
      callbackData === TELEGRAM_CALLBACKS.refresh
    ) {
      await context.answerCbQuery('Đang làm mới Home...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.refresh',
        resourceType: 'telegram_callback',
        resourceId: callbackData,
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

    if (callbackData === TELEGRAM_CALLBACKS.dashboard) {
      const dashboardSnapshot =
        await this.dashboardService.getDashboardSnapshot(
          authorizationResult.user.role,
        );

      await context.answerCbQuery('Đang mở Dashboard...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.dashboard',
        resourceType: 'telegram_callback',
        resourceId: callbackData,
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

    if (callbackData === TELEGRAM_CALLBACKS.database) {
      const databaseSnapshot = await this.backupService.getDatabaseStatus();

      await context.answerCbQuery('Đang tải trạng thái database...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.database',
        resourceType: 'telegram_callback',
        resourceId: callbackData,
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

    if (callbackData === TELEGRAM_CALLBACKS.backup) {
      const backupSnapshot = await this.backupService.getBackupOverview();

      await context.answerCbQuery('Đang tải trạng thái backup...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.backup',
        resourceType: 'telegram_callback',
        resourceId: callbackData,
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
        keyboard:
          this.navigationService.buildFeaturePlaceholder('Backup').keyboard,
      });
      return;
    }

    if (callbackData === TELEGRAM_CALLBACKS.docker) {
      try {
        const overview = await this.dockerService.getOverview();

        await context.answerCbQuery('Đang tải Docker...');
        await this.auditService.record({
          actorUserId: authorizationResult.user.id,
          action: 'telegram.docker',
          resourceType: 'telegram_callback',
          resourceId: callbackData,
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
          ].join('\n'),
          keyboard:
            this.navigationService.buildFeaturePlaceholder('Docker').keyboard,
        });
      } catch (error) {
        await context.answerCbQuery('Không thể kết nối Docker daemon.', {
          show_alert: true,
        });
        this.logUnhandledError(error);
      }
      return;
    }

    if (callbackData === TELEGRAM_CALLBACKS.logs) {
      try {
        const logsSnapshot = await this.dockerService.getRecentLogs();

        await context.answerCbQuery('Đang tải logs...');
        await this.auditService.record({
          actorUserId: authorizationResult.user.id,
          action: 'telegram.logs',
          resourceType: 'telegram_callback',
          resourceId: callbackData,
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

    if (callbackData === TELEGRAM_CALLBACKS.server) {
      const serverSnapshot = await this.serverService.getServerSnapshot();

      await context.answerCbQuery('Đang tải thông tin server...');
      await this.auditService.record({
        actorUserId: authorizationResult.user.id,
        action: 'telegram.server',
        resourceType: 'telegram_callback',
        resourceId: callbackData,
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

    const requiredPermission = CALLBACK_PERMISSIONS[callbackData];

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
        resourceId: callbackData,
        requestId: String(context.update.update_id ?? ''),
        payloadJson: {
          permission: requiredPermission,
        },
        result: AuditResult.DENIED,
      });
      return;
    }

    await context.answerCbQuery('Tính năng đang được triển khai.');
    await this.auditService.record({
      actorUserId: authorizationResult.user.id,
      action: 'telegram.callback',
      resourceType: 'telegram_callback',
      resourceId: callbackData,
      requestId: String(context.update.update_id ?? ''),
      payloadJson: {
        role: authorizationResult.user.role,
      },
      result: AuditResult.SUCCESS,
    });
    await this.menuRenderer.renderScreen(
      context,
      this.navigationService.buildFeaturePlaceholder(
        FEATURE_LABELS[callbackData],
      ),
    );
  }

  logUnhandledError(error: unknown): void {
    this.logger.error({ err: error }, 'Telegram update processing failed.');
  }

  private isNavigationCallback(value: string): value is TelegramCallback {
    return Object.values(TELEGRAM_CALLBACKS).includes(
      value as TelegramCallback,
    );
  }
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
