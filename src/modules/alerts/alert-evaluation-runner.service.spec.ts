import { ConfigService } from '@nestjs/config';
import { MonitoringService } from 'src/modules/monitoring/monitoring.service';
import { AlertEvaluationRunnerService } from './alert-evaluation-runner.service';
import { AlertsService } from './alerts.service';

describe('AlertEvaluationRunnerService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('schedules background evaluation outside the test environment', async () => {
    const alertsService = {
      evaluateTargets: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
        if (key === 'app.environment') {
          return 'production';
        }

        if (key === 'MONITOR_SAMPLE_INTERVAL_SECONDS') {
          return 30;
        }

        return fallback;
      }),
    };
    const monitoringService = {
      getOverview: jest.fn().mockResolvedValue({
        targets: [],
      }),
    };
    const service = new AlertEvaluationRunnerService(
      alertsService as unknown as AlertsService,
      configService as unknown as ConfigService,
      monitoringService as unknown as MonitoringService,
    );

    service.onModuleInit();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(30_000);

    expect(monitoringService.getOverview).toHaveBeenCalledTimes(2);
    expect(alertsService.evaluateTargets).toHaveBeenCalledTimes(2);

    service.onModuleDestroy();
  });

  it('does not schedule work in the test environment', () => {
    const alertsService = {
      evaluateTargets: jest.fn(),
    };
    const monitoringService = {
      getOverview: jest.fn(),
    };
    const service = new AlertEvaluationRunnerService(
      alertsService as unknown as AlertsService,
      {
        get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
          if (key === 'app.environment') {
            return 'test';
          }

          return fallback;
        }),
      } as unknown as ConfigService,
      monitoringService as unknown as MonitoringService,
    );

    service.onModuleInit();
    jest.advanceTimersByTime(60_000);

    expect(monitoringService.getOverview).not.toHaveBeenCalled();
    expect(alertsService.evaluateTargets).not.toHaveBeenCalled();
  });
});
