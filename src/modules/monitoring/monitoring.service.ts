import { Injectable } from '@nestjs/common';
import { HealthCheckStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import {
  HealthTargetSummary,
  HealthTargetsOverview,
  HealthTargetsService,
} from './health-targets.service';
import { HttpHealthGateway } from './http-health.gateway';

export type MonitoringTargetStatus = HealthTargetSummary & {
  status: HealthCheckStatus | 'DISABLED';
  responseTimeMs: number | null;
  statusCode: number | null;
  errorMessage: string | null;
  checkedAt: Date | null;
};

export type MonitoringOverview = Omit<HealthTargetsOverview, 'targets'> & {
  healthyCount: number;
  degradedCount: number;
  downCount: number;
  targets: MonitoringTargetStatus[];
};

@Injectable()
export class MonitoringService {
  constructor(
    private readonly healthTargetsService: HealthTargetsService,
    private readonly prismaService: PrismaService,
    private readonly httpHealthGateway: HttpHealthGateway,
  ) {}

  async getOverview(): Promise<MonitoringOverview> {
    const overview = await this.healthTargetsService.getOverview();
    const targets = await Promise.all(
      overview.targets.map((target) => this.buildTargetStatus(target)),
    );

    return {
      ...overview,
      healthyCount: targets.filter(
        (target) => target.status === HealthCheckStatus.HEALTHY,
      ).length,
      degradedCount: targets.filter(
        (target) => target.status === HealthCheckStatus.DEGRADED,
      ).length,
      downCount: targets.filter(
        (target) => target.status === HealthCheckStatus.DOWN,
      ).length,
      targets,
    };
  }

  private async buildTargetStatus(
    target: HealthTargetSummary,
  ): Promise<MonitoringTargetStatus> {
    if (!target.enabled) {
      return {
        ...target,
        status: 'DISABLED',
        responseTimeMs: null,
        statusCode: null,
        errorMessage: null,
        checkedAt: null,
      };
    }

    const probeResult = await this.httpHealthGateway.checkTarget(target);
    const checkedAt = new Date();

    await this.prismaService.monitoringSample.create({
      data: {
        targetName: target.name,
        status: probeResult.status,
        responseTimeMs: probeResult.responseTimeMs,
        metaJson: {
          displayName: target.displayName,
          url: target.url,
          method: target.method,
          expectedStatus: target.expectedStatus,
          statusCode: probeResult.statusCode,
          errorMessage: probeResult.errorMessage,
        },
        createdAt: checkedAt,
      },
    });

    return {
      ...target,
      status: probeResult.status,
      responseTimeMs: probeResult.responseTimeMs,
      statusCode: probeResult.statusCode,
      errorMessage: probeResult.errorMessage,
      checkedAt,
    };
  }
}
