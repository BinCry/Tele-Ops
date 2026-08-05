import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MonitoringService } from 'src/modules/monitoring/monitoring.service';
import { AlertsService } from './alerts.service';

@Injectable()
export class AlertEvaluationRunnerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AlertEvaluationRunnerService.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly alertsService: AlertsService,
    private readonly configService: ConfigService,
    private readonly monitoringService: MonitoringService,
  ) {}

  onModuleInit(): void {
    const environment = this.configService.get<string>(
      'app.environment',
      'development',
    );

    if (environment === 'test') {
      return;
    }

    const intervalSeconds = this.configService.get<number>(
      'MONITOR_SAMPLE_INTERVAL_SECONDS',
      60,
    );

    void this.runOnce();
    this.intervalHandle = setInterval(() => {
      void this.runOnce();
    }, intervalSeconds * 1000);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async runOnce(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const monitoringOverview = await this.monitoringService.getOverview();
      await this.alertsService.evaluateTargets(monitoringOverview);
    } catch (error) {
      this.logger.error('Background alert evaluation failed.', error);
    } finally {
      this.isRunning = false;
    }
  }
}
