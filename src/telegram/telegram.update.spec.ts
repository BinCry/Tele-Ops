import { UserRole, UserStatus } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { TelegramRateLimitService } from 'src/common/rate-limit/telegram-rate-limit.service';
import { AuthService } from 'src/modules/auth/auth.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import { DockerService } from 'src/modules/docker/docker.service';
import { RbacService } from 'src/modules/rbac/rbac.service';
import { ServerService } from 'src/modules/server/server.service';
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
  let dashboardService: { getDashboardSnapshot: jest.Mock };
  let dockerService: { getOverview: jest.Mock; getRecentLogs: jest.Mock };
  let serverService: { getServerSnapshot: jest.Mock };

  beforeEach(() => {
    authService = {
      authorizeTelegramContext: jest.fn(),
    };
    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    rateLimitService = {
      consume: jest.fn().mockReturnValue({ allowed: true }),
    };
    dashboardService = {
      getDashboardSnapshot: jest.fn(),
    };
    dockerService = {
      getOverview: jest.fn(),
      getRecentLogs: jest.fn(),
    };
    serverService = {
      getServerSnapshot: jest.fn(),
    };

    telegramUpdate = new TelegramUpdate(
      authService as unknown as AuthService,
      auditService as unknown as AuditService,
      new RbacService(),
      rateLimitService as unknown as TelegramRateLimitService,
      dashboardService as unknown as DashboardService,
      dockerService as unknown as DockerService,
      serverService as unknown as ServerService,
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
});
