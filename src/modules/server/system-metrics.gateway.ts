import { Injectable } from '@nestjs/common';
import si from 'systeminformation';

export type SystemMetricsSnapshot = {
  hostname: string;
  platform: string;
  distro: string;
  release: string;
  uptimeSeconds: number;
  cpuUsagePercent: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
};

@Injectable()
export class SystemMetricsGateway {
  async collectSnapshot(): Promise<SystemMetricsSnapshot> {
    const time = si.time();
    const [osInfo, currentLoad, memory, fileSystems] = await Promise.all([
      si.osInfo(),
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
    ]);

    const diskTotals = fileSystems.reduce(
      (accumulator, current) => ({
        used: accumulator.used + current.used,
        size: accumulator.size + current.size,
      }),
      { used: 0, size: 0 },
    );

    return {
      hostname: osInfo.hostname,
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      uptimeSeconds: time.uptime,
      cpuUsagePercent: currentLoad.currentLoad,
      memoryUsedBytes: memory.active,
      memoryTotalBytes: memory.total,
      diskUsedBytes: diskTotals.used,
      diskTotalBytes: diskTotals.size,
    };
  }
}
