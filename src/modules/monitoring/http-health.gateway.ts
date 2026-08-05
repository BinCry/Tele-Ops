import { Injectable } from '@nestjs/common';
import { HealthCheckStatus } from '@prisma/client';
import { HealthTargetSummary } from './health-targets.service';

export type HealthProbeResult = {
  status: HealthCheckStatus;
  responseTimeMs: number;
  statusCode: number | null;
  errorMessage: string | null;
};

@Injectable()
export class HttpHealthGateway {
  async checkTarget(
    target: Pick<
      HealthTargetSummary,
      'url' | 'method' | 'expectedStatus' | 'timeoutMs'
    >,
  ): Promise<HealthProbeResult> {
    const startedAt = Date.now();

    try {
      const response = await fetch(target.url, {
        method: target.method,
        redirect: 'follow',
        signal: AbortSignal.timeout(target.timeoutMs),
      });
      const responseTimeMs = Math.max(1, Date.now() - startedAt);
      const status =
        response.status === target.expectedStatus
          ? HealthCheckStatus.HEALTHY
          : HealthCheckStatus.DEGRADED;

      return {
        status,
        responseTimeMs,
        statusCode: response.status,
        errorMessage:
          status === HealthCheckStatus.HEALTHY
            ? null
            : `Expected HTTP ${target.expectedStatus} but received ${response.status}.`,
      };
    } catch (error) {
      return {
        status: HealthCheckStatus.DOWN,
        responseTimeMs: Math.max(1, Date.now() - startedAt),
        statusCode: null,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
