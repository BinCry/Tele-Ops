import { ServerService } from './server.service';
import { SystemMetricsGateway } from './system-metrics.gateway';

describe('ServerService', () => {
  it('returns the gateway snapshot unchanged', async () => {
    const snapshot = {
      hostname: 'teleops-host',
      platform: 'linux',
      distro: 'Ubuntu',
      release: '24.04',
      uptimeSeconds: 7200,
      cpuUsagePercent: 12.34,
      memoryUsedBytes: 2_000,
      memoryTotalBytes: 4_000,
      diskUsedBytes: 10_000,
      diskTotalBytes: 20_000,
    };

    const gateway = {
      collectSnapshot: jest.fn().mockResolvedValue(snapshot),
    } as unknown as SystemMetricsGateway;

    const service = new ServerService(gateway);

    await expect(service.getServerSnapshot()).resolves.toEqual(snapshot);
  });
});
