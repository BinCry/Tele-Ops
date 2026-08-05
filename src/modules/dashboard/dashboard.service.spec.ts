import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { ServerService } from '../server/server.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('maps server metrics into a dashboard snapshot', async () => {
    const serverService = {
      getServerSnapshot: jest.fn().mockResolvedValue({
        hostname: 'teleops-host',
        platform: 'linux',
        distro: 'Ubuntu',
        release: '24.04',
        uptimeSeconds: 3600,
        cpuUsagePercent: 33.3,
        memoryUsedBytes: 4,
        memoryTotalBytes: 8,
        diskUsedBytes: 50,
        diskTotalBytes: 100,
      }),
    } as unknown as ServerService;

    const configService = {
      get: jest.fn((key: string, defaultValue: string) => {
        const values: Record<string, string> = {
          'app.name': 'TeleOps',
          'app.environment': 'test',
          'app.timezone': 'Asia/Ho_Chi_Minh',
        };

        return values[key] ?? defaultValue;
      }),
    } as unknown as ConfigService;

    const service = new DashboardService(configService, serverService);

    await expect(service.getDashboardSnapshot(UserRole.ADMIN)).resolves.toEqual(
      {
        appName: 'TeleOps',
        environment: 'test',
        timezone: 'Asia/Ho_Chi_Minh',
        role: UserRole.ADMIN,
        hostname: 'teleops-host',
        cpuUsagePercent: 33.3,
        memoryUsagePercent: 50,
        diskUsagePercent: 50,
        uptimeSeconds: 3600,
      },
    );
  });
});
