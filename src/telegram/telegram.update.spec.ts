import { UserRole, UserStatus } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { TelegramRateLimitService } from 'src/common/rate-limit/telegram-rate-limit.service';
import { ActionRequestService } from 'src/modules/action-request/action-request.service';
import { AuthService } from 'src/modules/auth/auth.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { BackupService } from 'src/modules/backup/backup.service';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import { DockerService } from 'src/modules/docker/docker.service';
import { RbacService } from 'src/modules/rbac/rbac.service';
import { ServerService } from 'src/modules/server/server.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { UsersService } from 'src/modules/users/users.service';
import { TELEGRAM_CALLBACKS } from './callbacks/callback-data';
import { TelegramBotContext } from './context/telegram-context';
import { TelegramNavigationService } from './navigation/navigation.service';
import { TelegramMenuRenderer } from './renderers/menu-renderer.service';
import { TelegramUpdate } from './telegram.update';

function createMockContext(
  userId: number,
  mode: 'message' | 'callback' = 'message',
): {
  context: TelegramBotContext;
  replyMock: jest.Mock;
  editMessageTextMock: jest.Mock;
  answerCbQueryMock: jest.Mock;
} {
  const replyMock = jest.fn().mockResolvedValue(undefined);
  const editMessageTextMock = jest.fn().mockResolvedValue(undefined);
  const answerCbQueryMock = jest.fn().mockResolvedValue(undefined);

  const context = {
    from: { id: userId },
    update:
      mode === 'callback'
        ? { update_id: 1, callback_query: { id: 'callback-id' } }
        : { update_id: 1, message: { message_id: 1 } },
    reply: replyMock,
    editMessageText: editMessageTextMock,
    answerCbQuery: answerCbQueryMock,
  };

  return {
    context: context as unknown as TelegramBotContext,
    replyMock,
    editMessageTextMock,
    answerCbQueryMock,
  };
}

describe('TelegramUpdate', () => {
  let telegramUpdate: TelegramUpdate;
  let authService: { authorizeTelegramContext: jest.Mock };
  let auditService: { record: jest.Mock };
  let rateLimitService: { consume: jest.Mock };
  let actionRequestService: {
    createPendingRequest: jest.Mock;
    resolveForActor: jest.Mock;
    markConfirmed: jest.Mock;
    markExecuted: jest.Mock;
    markCancelled: jest.Mock;
    markFailed: jest.Mock;
  };
  let backupService: {
    getDatabaseStatus: jest.Mock;
    getBackupOverview: jest.Mock;
  };
  let dashboardService: { getDashboardSnapshot: jest.Mock };
  let dockerService: {
    getOverview: jest.Mock;
    getRecentLogs: jest.Mock;
    getDangerousActionsEnabled: jest.Mock;
    findActionTarget: jest.Mock;
  };
  let serverService: { getServerSnapshot: jest.Mock };
  let usersService: { listUserSummaries: jest.Mock };
  let settingsService: { getSettingsSnapshot: jest.Mock };

  beforeEach(() => {
    authService = {
      authorizeTelegramContext: jest.fn(),
    };
    actionRequestService = {
      createPendingRequest: jest.fn(),
      resolveForActor: jest.fn(),
      markConfirmed: jest.fn().mockResolvedValue(undefined),
      markExecuted: jest.fn().mockResolvedValue(undefined),
      markCancelled: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    rateLimitService = {
      consume: jest.fn().mockReturnValue({ allowed: true }),
    };
    backupService = {
      getDatabaseStatus: jest.fn(),
      getBackupOverview: jest.fn(),
    };
    dashboardService = {
      getDashboardSnapshot: jest.fn(),
    };
    dockerService = {
      getOverview: jest.fn(),
      getRecentLogs: jest.fn(),
      getDangerousActionsEnabled: jest.fn(),
      findActionTarget: jest.fn(),
    };
    serverService = {
      getServerSnapshot: jest.fn(),
    };
    usersService = {
      listUserSummaries: jest.fn(),
    };
    settingsService = {
      getSettingsSnapshot: jest.fn(),
    };

    telegramUpdate = new TelegramUpdate(
      actionRequestService as unknown as ActionRequestService,
      authService as unknown as AuthService,
      auditService as unknown as AuditService,
      new RbacService(),
      rateLimitService as unknown as TelegramRateLimitService,
      backupService as unknown as BackupService,
      dashboardService as unknown as DashboardService,
      dockerService as unknown as DockerService,
      serverService as unknown as ServerService,
      usersService as unknown as UsersService,
      settingsService as unknown as SettingsService,
      new TelegramNavigationService(new RbacService()),
      new TelegramMenuRenderer(),
      {
        error: jest.fn(),
      } as unknown as PinoLogger,
    );
  });

  it('renders the authorized home screen on /start', async () => {
    const { context, replyMock } = createMockContext(123456789);

    authService.authorizeTelegramContext.mockResolvedValue({
      status: 'authorized',
      user: {
        id: 'user-1',
        telegramUserId: '123456789',
        displayName: 'Owner User',
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
      },
    });

    await telegramUpdate.handleStart(context);

    expect(replyMock).toHaveBeenCalledWith(
      expect.stringContaining('Owner User'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
  });

  it('renders the unauthorized screen for unknown users', async () => {
    const { context, replyMock } = createMockContext(999999999);

    authService.authorizeTelegramContext.mockResolvedValue({
      status: 'unauthorized',
      telegramUserId: '999999999',
      reason: 'unknown_user',
      message:
        'Tài khoản Telegram này hiện chưa được cấp quyền truy cập TeleOps.',
    });

    await telegramUpdate.handleStart(context);

    expect(replyMock).toHaveBeenCalledWith(
      expect.stringContaining('999999999'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
    expect(auditService.record).toHaveBeenCalled();
  });

  it('acknowledges callbacks and refreshes the home screen for authorized users', async () => {
    const { context, answerCbQueryMock, editMessageTextMock } =
      createMockContext(123456789, 'callback');

    authService.authorizeTelegramContext.mockResolvedValue({
      status: 'authorized',
      user: {
        id: 'user-1',
        telegramUserId: '123456789',
        displayName: 'Owner User',
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
      },
    });

    await telegramUpdate.handleCallback(context, TELEGRAM_CALLBACKS.refresh);

    expect(answerCbQueryMock).toHaveBeenCalledWith('Đang làm mới Home...');
    expect(editMessageTextMock).toHaveBeenCalled();
  });

  it('renders the database status screen for authorized users', async () => {
    const { context, answerCbQueryMock, editMessageTextMock } =
      createMockContext(123456789, 'callback');

    authService.authorizeTelegramContext.mockResolvedValue({
      status: 'authorized',
      user: {
        id: 'user-1',
        telegramUserId: '123456789',
        displayName: 'Owner User',
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
      },
    });
    backupService.getDatabaseStatus.mockResolvedValue({
      host: 'db:5432',
      databaseName: 'teleops',
      reachable: true,
    });

    await telegramUpdate.handleCallback(context, TELEGRAM_CALLBACKS.database);

    expect(answerCbQueryMock).toHaveBeenCalledWith(
      'Đang tải trạng thái database...',
    );
    expect(editMessageTextMock).toHaveBeenCalledWith(
      expect.stringContaining('db:5432'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
  });

  it('denies a forged docker callback for viewers', async () => {
    const { context, answerCbQueryMock, editMessageTextMock } =
      createMockContext(123456789, 'callback');

    authService.authorizeTelegramContext.mockResolvedValue({
      status: 'authorized',
      user: {
        id: 'user-1',
        telegramUserId: '123456789',
        displayName: 'Viewer User',
        role: UserRole.VIEWER,
        status: UserStatus.ACTIVE,
      },
    });

    await telegramUpdate.handleCallback(context, TELEGRAM_CALLBACKS.docker);

    expect(answerCbQueryMock).toHaveBeenCalledWith(
      'Bạn không có quyền thực hiện thao tác này.',
      expect.objectContaining({
        show_alert: true,
      }),
    );
    expect(editMessageTextMock).not.toHaveBeenCalled();
    expect(dockerService.getOverview).not.toHaveBeenCalled();
  });

  it('creates a confirmation flow for docker restart requests', async () => {
    const { context, answerCbQueryMock, editMessageTextMock } =
      createMockContext(123456789, 'callback');

    authService.authorizeTelegramContext.mockResolvedValue({
      status: 'authorized',
      user: {
        id: 'user-1',
        telegramUserId: '123456789',
        displayName: 'Operator User',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
      },
    });
    dockerService.getDangerousActionsEnabled.mockReturnValue(true);
    dockerService.findActionTarget.mockResolvedValue({
      id: '1234567890ab',
      shortId: '1234567890ab',
      name: 'teleops-app',
      image: 'teleops:latest',
      state: 'running',
      status: 'Up 5m',
      availableActions: ['restart', 'stop'],
    });
    actionRequestService.createPendingRequest.mockResolvedValue({
      id: 'request-1',
      token: '6d7d86f7-657b-4f6d-8c2f-3f8efec2eb89',
    });

    await telegramUpdate.handleCallback(
      context,
      'action:docker:restart:1234567890ab',
    );

    expect(answerCbQueryMock).toHaveBeenCalledWith(
      'Cần xác nhận thao tác Docker.',
    );
    expect(editMessageTextMock).toHaveBeenCalledWith(
      expect.stringContaining('teleops-app'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
    expect(actionRequestService.createPendingRequest).toHaveBeenCalled();
  });
});
