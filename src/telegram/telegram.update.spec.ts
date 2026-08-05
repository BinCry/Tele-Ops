import { UserRole, UserStatus } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { TelegramRateLimitService } from 'src/common/rate-limit/telegram-rate-limit.service';
import { ActionRequestService } from 'src/modules/action-request/action-request.service';
import { AlertsService } from 'src/modules/alerts/alerts.service';
import { AuthService } from 'src/modules/auth/auth.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { BackupService } from 'src/modules/backup/backup.service';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import { DeploymentService } from 'src/modules/deploy/deployment.service';
import { DeployTargetsService } from 'src/modules/deploy/deploy-targets.service';
import { DockerService } from 'src/modules/docker/docker.service';
import { MonitoringService } from 'src/modules/monitoring/monitoring.service';
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
  replyWithDocumentMock: jest.Mock;
  editMessageTextMock: jest.Mock;
  answerCbQueryMock: jest.Mock;
} {
  const replyMock = jest.fn().mockResolvedValue(undefined);
  const replyWithDocumentMock = jest.fn().mockResolvedValue(undefined);
  const editMessageTextMock = jest.fn().mockResolvedValue(undefined);
  const answerCbQueryMock = jest.fn().mockResolvedValue(undefined);

  const context = {
    from: { id: userId },
    update:
      mode === 'callback'
        ? { update_id: 1, callback_query: { id: 'callback-id' } }
        : { update_id: 1, message: { message_id: 1 } },
    reply: replyMock,
    replyWithDocument: replyWithDocumentMock,
    editMessageText: editMessageTextMock,
    answerCbQuery: answerCbQueryMock,
  };

  return {
    context: context as unknown as TelegramBotContext,
    replyMock,
    replyWithDocumentMock,
    editMessageTextMock,
    answerCbQueryMock,
  };
}

describe('TelegramUpdate', () => {
  let telegramUpdate: TelegramUpdate;
  let authService: { authorizeTelegramContext: jest.Mock };
  let alertsService: { evaluateTargets: jest.Mock };
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
    createBackup: jest.Mock;
    getLatestSuccessfulBackupArtifactForTelegram: jest.Mock;
    getTelegramDeliveryDecision: jest.Mock;
  };
  let dashboardService: { getDashboardSnapshot: jest.Mock };
  let deploymentService: {
    getRollbackPreview: jest.Mock;
    rollbackDeployment: jest.Mock;
    runDeployment: jest.Mock;
  };
  let deployTargetsService: {
    getOverview: jest.Mock;
    getEnabledTargetByName: jest.Mock;
  };
  let dockerService: {
    getOverview: jest.Mock;
    getRecentLogs: jest.Mock;
    getDangerousActionsEnabled: jest.Mock;
    getActionTargets: jest.Mock;
    findActionTarget: jest.Mock;
    executeAction: jest.Mock;
  };
  let monitoringService: { getOverview: jest.Mock };
  let serverService: { getServerSnapshot: jest.Mock };
  let usersService: { listUserSummaries: jest.Mock };
  let settingsService: { getSettingsSnapshot: jest.Mock };

  beforeEach(() => {
    authService = {
      authorizeTelegramContext: jest.fn(),
    };
    alertsService = {
      evaluateTargets: jest.fn(),
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
      createBackup: jest.fn(),
      getLatestSuccessfulBackupArtifactForTelegram: jest.fn(),
      getTelegramDeliveryDecision: jest.fn().mockReturnValue({
        eligible: false,
        maxTelegramSizeMb: 20,
      }),
    };
    dashboardService = {
      getDashboardSnapshot: jest.fn(),
    };
    deploymentService = {
      getRollbackPreview: jest.fn(),
      rollbackDeployment: jest.fn(),
      runDeployment: jest.fn(),
    };
    deployTargetsService = {
      getOverview: jest.fn(),
      getEnabledTargetByName: jest.fn(),
    };
    dockerService = {
      getOverview: jest.fn(),
      getRecentLogs: jest.fn(),
      getDangerousActionsEnabled: jest.fn(),
      getActionTargets: jest.fn(),
      findActionTarget: jest.fn(),
      executeAction: jest.fn(),
    };
    monitoringService = {
      getOverview: jest.fn(),
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
      alertsService as unknown as AlertsService,
      auditService as unknown as AuditService,
      new RbacService(),
      rateLimitService as unknown as TelegramRateLimitService,
      backupService as unknown as BackupService,
      dashboardService as unknown as DashboardService,
      deploymentService as unknown as DeploymentService,
      deployTargetsService as unknown as DeployTargetsService,
      dockerService as unknown as DockerService,
      monitoringService as unknown as MonitoringService,
      serverService as unknown as ServerService,
      usersService as unknown as UsersService,
      settingsService as unknown as SettingsService,
      new TelegramNavigationService(new RbacService()),
      new TelegramMenuRenderer(),
      {
        error: jest.fn(),
        warn: jest.fn(),
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

  it('creates a confirmation flow for backup execution requests', async () => {
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
    actionRequestService.createPendingRequest.mockResolvedValue({
      id: 'request-1',
      token: '6d7d86f7-657b-4f6d-8c2f-3f8efec2eb89',
    });

    await telegramUpdate.handleCallback(context, 'action:backup:create');

    expect(answerCbQueryMock).toHaveBeenCalledWith('Cần xác nhận tạo backup.');
    expect(editMessageTextMock).toHaveBeenCalledWith(
      expect.stringContaining('pg_dump'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
  });

  it('sends the latest successful backup artifact on request', async () => {
    const { context, answerCbQueryMock, replyWithDocumentMock } =
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
    backupService.getLatestSuccessfulBackupArtifactForTelegram.mockResolvedValue(
      {
        filename: 'teleops-latest.sql',
        storagePath: '/data/backups/teleops-latest.sql',
        checksumSha256: 'a'.repeat(64),
        sizeBytes: BigInt(1024),
      },
    );

    await telegramUpdate.handleCallback(
      context,
      'action:backup:download-latest',
    );

    expect(answerCbQueryMock).toHaveBeenCalledWith(
      'Đang gửi backup gần nhất...',
    );
    expect(
      backupService.getLatestSuccessfulBackupArtifactForTelegram,
    ).toHaveBeenCalled();
    expect(replyWithDocumentMock).toHaveBeenCalled();
  });

  it('creates a confirmation flow for deploy execution requests', async () => {
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
    deployTargetsService.getEnabledTargetByName.mockResolvedValue({
      name: 'teleops-prod',
      displayName: 'TeleOps Production',
      workingDirectory: '/opt/teleops',
      repositoryUrl: 'https://github.com/BinCry/Tele-Ops.git',
      branch: 'main',
      composeFile: 'docker-compose.production.yml',
      composeProject: 'teleops',
      healthTargetName: 'teleops-http',
      enabled: true,
    });
    actionRequestService.createPendingRequest.mockResolvedValue({
      id: 'request-1',
      token: '6d7d86f7-657b-4f6d-8c2f-3f8efec2eb89',
    });

    await telegramUpdate.handleCallback(
      context,
      'action:deploy:run:teleops-prod',
    );

    expect(answerCbQueryMock).toHaveBeenCalledWith(
      'Cần xác nhận chạy deployment.',
    );
    expect(editMessageTextMock).toHaveBeenCalledWith(
      expect.stringContaining('TeleOps Production'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
    expect(actionRequestService.createPendingRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'deploy.run',
        resourceId: 'teleops-prod',
      }),
    );
  });

  it('creates a confirmation flow for deploy rollback requests', async () => {
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
    deploymentService.getRollbackPreview.mockResolvedValue({
      targetName: 'TeleOps Production',
      currentCommit: '2222222222222222222222222222222222222222',
      rollbackCommit: '1111111111111111111111111111111111111111',
      latestRunStatus: 'SUCCESS',
    });
    deployTargetsService.getEnabledTargetByName.mockResolvedValue({
      name: 'teleops-prod',
      displayName: 'TeleOps Production',
      workingDirectory: '/opt/teleops',
      repositoryUrl: 'https://github.com/BinCry/Tele-Ops.git',
      branch: 'main',
      composeFile: 'docker-compose.production.yml',
      composeProject: 'teleops',
      healthTargetName: 'teleops-http',
      enabled: true,
    });
    actionRequestService.createPendingRequest.mockResolvedValue({
      id: 'request-rollback-1',
      token: '6d7d86f7-657b-4f6d-8c2f-3f8efec2eb89',
    });

    await telegramUpdate.handleCallback(
      context,
      'action:deploy:rollback:teleops-prod',
    );

    expect(answerCbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('rollback deployment'),
    );
    expect(editMessageTextMock).toHaveBeenCalledWith(
      expect.stringContaining('1111111111111111111111111111111111111111'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
    expect(actionRequestService.createPendingRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'deploy.rollback',
        resourceId: 'teleops-prod',
      }),
    );
  });

  it('renders the deploy overview screen for authorized users', async () => {
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
    deployTargetsService.getOverview.mockResolvedValue({
      configPath: '/app/config/deploy-targets.yaml',
      fileExists: true,
      enabledTargetCount: 1,
      disabledTargetCount: 0,
      targets: [
        {
          name: 'teleops-prod',
          displayName: 'TeleOps Production',
          workingDirectory: '/opt/teleops',
          repositoryUrl: 'https://github.com/BinCry/Tele-Ops.git',
          branch: 'main',
          composeFile: 'docker-compose.production.yml',
          composeProject: 'teleops',
          healthTargetName: 'teleops-http',
          enabled: true,
        },
      ],
    });

    await telegramUpdate.handleCallback(context, TELEGRAM_CALLBACKS.deploy);

    expect(answerCbQueryMock).toHaveBeenCalledWith(
      'Đang tải deployment targets...',
    );
    expect(editMessageTextMock).toHaveBeenCalledWith(
      expect.stringContaining('TeleOps Production'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
    const firstCall = editMessageTextMock.mock.calls.at(0) as
      | [
          string,
          {
            parse_mode: string;
            reply_markup: {
              inline_keyboard: Array<Array<{ callback_data?: string }>>;
            };
          },
        ]
      | undefined;

    expect(firstCall).toBeDefined();
    expect(firstCall?.[1].parse_mode).toBe('HTML');
    expect(firstCall?.[1].reply_markup.inline_keyboard.flat()).toContainEqual(
      expect.objectContaining({
        callback_data: 'action:deploy:run:teleops-prod',
      }),
    );
    expect(firstCall?.[1].reply_markup.inline_keyboard.flat()).toContainEqual(
      expect.objectContaining({
        callback_data: 'action:deploy:rollback:teleops-prod',
      }),
    );
  });

  it('renders the monitoring overview screen for authorized users', async () => {
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
    monitoringService.getOverview.mockResolvedValue({
      configPath: '/app/config/health-targets.yaml',
      fileExists: true,
      enabledTargetCount: 1,
      disabledTargetCount: 0,
      healthyCount: 1,
      degradedCount: 0,
      downCount: 0,
      targets: [
        {
          name: 'teleops-http',
          displayName: 'TeleOps HTTP',
          url: 'https://teleops.example.com/health',
          method: 'GET',
          expectedStatus: 200,
          timeoutMs: 4000,
          enabled: true,
          status: 'HEALTHY',
          responseTimeMs: 120,
          statusCode: 200,
          errorMessage: null,
          checkedAt: new Date('2026-08-05T08:00:00.000Z'),
        },
      ],
    });
    alertsService.evaluateTargets.mockResolvedValue({
      configPath: '/app/config/alert-rules.yaml',
      fileExists: true,
      enabledRuleCount: 1,
      disabledRuleCount: 0,
      activeAlertCount: 1,
      resolvedAlertCount: 0,
      alerts: [
        {
          ruleName: 'teleops-http-down',
          displayName: 'TeleOps HTTP Down',
          severity: 'critical',
          targetName: 'teleops-http',
          summary: 'TeleOps HTTP: status DOWN',
          notificationState: 'sent',
        },
      ],
      rules: [],
    });

    await telegramUpdate.handleCallback(context, TELEGRAM_CALLBACKS.monitoring);

    expect(answerCbQueryMock).toHaveBeenCalledWith('Đang tải monitoring...');
    expect(editMessageTextMock).toHaveBeenCalledWith(
      expect.stringContaining('TeleOps HTTP'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
    expect(editMessageTextMock).toHaveBeenCalledWith(
      expect.stringContaining('TeleOps HTTP Down'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
  });

  it('executes backup creation after confirmation', async () => {
    const {
      context,
      answerCbQueryMock,
      editMessageTextMock,
      replyWithDocumentMock,
    } = createMockContext(123456789, 'callback');

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
    actionRequestService.resolveForActor.mockResolvedValue({
      status: 'ready',
      request: {
        id: 'request-1',
        actionType: 'backup.create',
        resourceType: 'postgres_backup',
        resourceId: null,
      },
    });
    backupService.createBackup.mockResolvedValue({
      filename: 'teleops-20260805-120000.sql',
      storagePath: '/data/backups/teleops-20260805-120000.sql',
      checksumSha256: 'a'.repeat(64),
      sizeBytes: BigInt(1024),
    });
    backupService.getTelegramDeliveryDecision.mockReturnValue({
      eligible: true,
      maxTelegramSizeMb: 20,
    });

    await telegramUpdate.handleCallback(
      context,
      'action:confirm:6d7d86f7-657b-4f6d-8c2f-3f8efec2eb89',
    );

    expect(answerCbQueryMock).toHaveBeenCalledWith('Đã tạo backup thành công.');
    expect(editMessageTextMock).toHaveBeenCalledWith(
      expect.stringContaining('teleops-20260805-120000.sql'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
    expect(backupService.createBackup).toHaveBeenCalledWith('user-1');
    expect(replyWithDocumentMock).toHaveBeenCalled();
  });

  it('executes deployment after confirmation', async () => {
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
    actionRequestService.resolveForActor.mockResolvedValue({
      status: 'ready',
      request: {
        id: 'request-1',
        actionType: 'deploy.run',
        resourceType: 'deployment_target',
        resourceId: 'teleops-prod',
      },
    });
    deploymentService.runDeployment.mockResolvedValue({
      targetName: 'TeleOps Production',
      previousCommit: '1111111111111111111111111111111111111111',
      deployedCommit: '2222222222222222222222222222222222222222',
      outputSummary: 'docker compose up -d --build',
    });

    await telegramUpdate.handleCallback(
      context,
      'action:confirm:6d7d86f7-657b-4f6d-8c2f-3f8efec2eb89',
    );

    expect(answerCbQueryMock).toHaveBeenCalledWith(
      'Đã chạy deployment thành công.',
    );
    expect(deploymentService.runDeployment).toHaveBeenCalledWith(
      'teleops-prod',
      'user-1',
    );
    expect(editMessageTextMock).toHaveBeenCalledWith(
      expect.stringContaining('TeleOps Production'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
  });

  it('executes deployment rollback after confirmation', async () => {
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
    actionRequestService.resolveForActor.mockResolvedValue({
      status: 'ready',
      request: {
        id: 'request-rollback-1',
        actionType: 'deploy.rollback',
        resourceType: 'deployment_target',
        resourceId: 'teleops-prod',
      },
    });
    deploymentService.rollbackDeployment.mockResolvedValue({
      targetName: 'TeleOps Production',
      previousCommit: '2222222222222222222222222222222222222222',
      rolledBackToCommit: '1111111111111111111111111111111111111111',
      outputSummary: 'git checkout 1111111 && docker compose up -d --build',
    });

    await telegramUpdate.handleCallback(
      context,
      'action:confirm:6d7d86f7-657b-4f6d-8c2f-3f8efec2eb89',
    );

    expect(answerCbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('rollback deployment'),
    );
    expect(deploymentService.rollbackDeployment).toHaveBeenCalledWith(
      'teleops-prod',
      'user-1',
    );
    expect(editMessageTextMock).toHaveBeenCalledWith(
      expect.stringContaining('1111111111111111111111111111111111111111'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
  });
});
