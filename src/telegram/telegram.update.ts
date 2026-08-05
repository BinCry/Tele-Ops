import { AuditResult } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { TelegramRateLimitService } from 'src/common/rate-limit/telegram-rate-limit.service';
import { AuthService } from 'src/modules/auth/auth.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { PERMISSIONS, Permission } from 'src/modules/rbac/permissions';
import { RbacService } from 'src/modules/rbac/rbac.service';
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
