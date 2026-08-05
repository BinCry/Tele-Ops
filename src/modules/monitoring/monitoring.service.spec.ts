import { HealthCheckStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { HealthTargetsService } from './health-targets.service';
import { MonitoringService } from './monitoring.service';

describe('MonitoringService', () => {
  it('probes enabled targets and persists monitoring samples', async () => {
    const healthTargetsService = {
      getOverview: jest.fn().mockResolvedValue({
        configPath: '/app/config/health-targets.yaml',
        fileExists: true,
        enabledTargetCount: 1,
        disabledTargetCount: 1,
        targets: [
          {
            name: 'teleops-http',
            displayName: 'TeleOps HTTP',
            url: 'https://teleops.example.com/health',
            method: 'GET',
            expectedStatus: 200,
            timeoutMs: 4000,
            enabled: true,
          },
          {
            name: 'teleops-admin',
            displayName: 'TeleOps Admin',
            url: 'https://teleops.example.com/admin',
            method: 'HEAD',
            expectedStatus: 200,
            timeoutMs: 4000,
            enabled: false,
          },
        ],
      }),
    };
    const prismaService = {
      monitoringSample: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    const httpHealthGateway = {
      checkTarget: jest.fn().mockResolvedValue({
        status: HealthCheckStatus.HEALTHY,
        responseTimeMs: 123,
        statusCode: 200,
        errorMessage: null,
      }),
    };
    const service = new MonitoringService(
      healthTargetsService as unknown as HealthTargetsService,
      prismaService as unknown as PrismaService,
      httpHealthGateway,
    );

    const overview = await service.getOverview();

    expect(overview.healthyCount).toBe(1);
    expect(overview.degradedCount).toBe(0);
    expect(overview.downCount).toBe(0);
    expect(overview.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'teleops-http',
          status: HealthCheckStatus.HEALTHY,
          responseTimeMs: 123,
          statusCode: 200,
        }),
        expect.objectContaining({
          name: 'teleops-admin',
          status: 'DISABLED',
          responseTimeMs: null,
        }),
      ]),
    );
    expect(httpHealthGateway.checkTarget).toHaveBeenCalledTimes(1);
    expect(prismaService.monitoringSample.create).toHaveBeenCalledTimes(1);
  });
});
