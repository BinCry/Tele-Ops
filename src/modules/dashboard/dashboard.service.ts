import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { ServerService } from '../server/server.service';

export type DashboardSnapshot = {
  appName: string;
  environment: string;
  timezone: string;
  role: UserRole;
  hostname: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  uptimeSeconds: number;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly configService: ConfigService,
    private readonly serverService: ServerService,
  ) {}

  async getDashboardSnapshot(role: UserRole): Promise<DashboardSnapshot> {
    const snapshot = await this.serverService.getServerSnapshot();

    return {
      appName: this.configService.get<string>('app.name', 'TeleOps'),
      environment: this.configService.get<string>(
        'app.environment',
        'development',
      ),
      timezone: this.configService.get<string>(
        'app.timezone',
        'Asia/Ho_Chi_Minh',
      ),
      role,
      hostname: snapshot.hostname,
      cpuUsagePercent: snapshot.cpuUsagePercent,
      memoryUsagePercent: percentage(
        snapshot.memoryUsedBytes,
        snapshot.memoryTotalBytes,
      ),
      diskUsagePercent: percentage(
        snapshot.diskUsedBytes,
        snapshot.diskTotalBytes,
      ),
      uptimeSeconds: snapshot.uptimeSeconds,
    };
  }
}

function percentage(used: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return (used / total) * 100;
}
