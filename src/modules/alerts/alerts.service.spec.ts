import { AlertEventStatus, HealthCheckStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { AlertRulesService } from './alert-rules.service';
import { AlertNotifierService } from './alert-notifier.service';
import { AlertsService } from './alerts.service';

describe('AlertsService', () => {
  it('opens a new alert event when a rule is triggered', async () => {
    const alertRulesService = {
      getOverview: jest.fn().mockResolvedValue({
        configPath: '/app/config/alert-rules.yaml',
        fileExists: true,
        enabledRuleCount: 1,
        disabledRuleCount: 0,
        rules: [
          {
            name: 'teleops-http-down',
            displayName: 'TeleOps HTTP Down',
            targetName: 'teleops-http',
            severity: 'critical',
            triggerOnStatuses: [HealthCheckStatus.DOWN],
            responseTimeMsAbove: undefined,
            cooldownMinutes: 15,
            enabled: true,
          },
        ],
      }),
    };
    const alertNotifierService = {
      notifyOpenAlert: jest.fn().mockResolvedValue(true),
      notifyResolvedAlert: jest.fn().mockResolvedValue(true),
    };
    const prismaService = {
      alertEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const service = new AlertsService(
      alertRulesService as unknown as AlertRulesService,
      alertNotifierService as unknown as AlertNotifierService,
      prismaService as unknown as PrismaService,
    );

    const overview = await service.evaluateTargets({
      targets: [
        {
          name: 'teleops-http',
          displayName: 'TeleOps HTTP',
          url: 'https://teleops.example.com/health',
          method: 'GET',
          expectedStatus: 200,
          timeoutMs: 4000,
          enabled: true,
          status: HealthCheckStatus.DOWN,
          responseTimeMs: 1200,
          statusCode: null,
          errorMessage: 'connect ECONNREFUSED',
          checkedAt: new Date('2026-08-05T10:00:00.000Z'),
        },
      ],
    });

    expect(overview.activeAlertCount).toBe(1);
    expect(overview.resolvedAlertCount).toBe(0);
    const createCall = prismaService.alertEvent.create.mock.calls.at(0) as
      | [
          {
            data: {
              ruleName: string;
              status: AlertEventStatus;
            };
          },
        ]
      | undefined;

    expect(createCall?.[0].data.ruleName).toBe('teleops-http-down');
    expect(createCall?.[0].data.status).toBe(AlertEventStatus.OPEN);
  });

  it('resolves an open alert when the target recovers', async () => {
    const alertRulesService = {
      getOverview: jest.fn().mockResolvedValue({
        configPath: '/app/config/alert-rules.yaml',
        fileExists: true,
        enabledRuleCount: 1,
        disabledRuleCount: 0,
        rules: [
          {
            name: 'teleops-http-down',
            displayName: 'TeleOps HTTP Down',
            targetName: 'teleops-http',
            severity: 'critical',
            triggerOnStatuses: [HealthCheckStatus.DOWN],
            responseTimeMsAbove: undefined,
            cooldownMinutes: 15,
            enabled: true,
          },
        ],
      }),
    };
    const alertNotifierService = {
      notifyOpenAlert: jest.fn().mockResolvedValue(true),
      notifyResolvedAlert: jest.fn().mockResolvedValue(true),
    };
    const prismaService = {
      alertEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'alert-1',
            ruleName: 'teleops-http-down',
            summary: 'TeleOps HTTP: status DOWN',
            lastNotifiedAt: new Date('2026-08-05T09:00:00.000Z'),
          },
        ]),
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const service = new AlertsService(
      alertRulesService as unknown as AlertRulesService,
      alertNotifierService as unknown as AlertNotifierService,
      prismaService as unknown as PrismaService,
    );

    const overview = await service.evaluateTargets({
      targets: [
        {
          name: 'teleops-http',
          displayName: 'TeleOps HTTP',
          url: 'https://teleops.example.com/health',
          method: 'GET',
          expectedStatus: 200,
          timeoutMs: 4000,
          enabled: true,
          status: HealthCheckStatus.HEALTHY,
          responseTimeMs: 120,
          statusCode: 200,
          errorMessage: null,
          checkedAt: new Date('2026-08-05T10:00:00.000Z'),
        },
      ],
    });

    expect(overview.activeAlertCount).toBe(0);
    expect(overview.resolvedAlertCount).toBe(1);
    const updateCall = prismaService.alertEvent.update.mock.calls.at(0) as
      | [
          {
            data: {
              status: AlertEventStatus;
            };
          },
        ]
      | undefined;

    expect(updateCall?.[0].data.status).toBe(AlertEventStatus.RESOLVED);
    expect(alertNotifierService.notifyResolvedAlert).toHaveBeenCalled();
  });

  it('suppresses repeated notifications inside the cooldown window', async () => {
    const now = new Date();
    const alertRulesService = {
      getOverview: jest.fn().mockResolvedValue({
        configPath: '/app/config/alert-rules.yaml',
        fileExists: true,
        enabledRuleCount: 1,
        disabledRuleCount: 0,
        rules: [
          {
            name: 'teleops-http-slow',
            displayName: 'TeleOps HTTP Slow',
            targetName: 'teleops-http',
            severity: 'warning',
            triggerOnStatuses: [],
            responseTimeMsAbove: 1000,
            cooldownMinutes: 15,
            enabled: true,
          },
        ],
      }),
    };
    const alertNotifierService = {
      notifyOpenAlert: jest.fn().mockResolvedValue(true),
      notifyResolvedAlert: jest.fn().mockResolvedValue(true),
    };
    const prismaService = {
      alertEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'alert-1',
            ruleName: 'teleops-http-slow',
            summary: 'TeleOps HTTP: response 2000ms vượt ngưỡng 1000ms',
            lastNotifiedAt: new Date(now.getTime() - 60_000),
          },
        ]),
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const service = new AlertsService(
      alertRulesService as unknown as AlertRulesService,
      alertNotifierService as unknown as AlertNotifierService,
      prismaService as unknown as PrismaService,
    );

    const overview = await service.evaluateTargets({
      targets: [
        {
          name: 'teleops-http',
          displayName: 'TeleOps HTTP',
          url: 'https://teleops.example.com/health',
          method: 'GET',
          expectedStatus: 200,
          timeoutMs: 4000,
          enabled: true,
          status: HealthCheckStatus.HEALTHY,
          responseTimeMs: 2000,
          statusCode: 200,
          errorMessage: null,
          checkedAt: now,
        },
      ],
    });

    expect(overview.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notificationState: 'suppressed',
        }),
      ]),
    );
    expect(alertNotifierService.notifyOpenAlert).not.toHaveBeenCalled();
  });
});
