import { Module } from '@nestjs/common';
import { MonitoringModule } from 'src/modules/monitoring/monitoring.module';
import { AlertEvaluationRunnerService } from './alert-evaluation-runner.service';
import { AlertNotifierService } from './alert-notifier.service';
import { AlertRulesService } from './alert-rules.service';
import { AlertsService } from './alerts.service';

@Module({
  imports: [MonitoringModule],
  providers: [
    AlertEvaluationRunnerService,
    AlertNotifierService,
    AlertRulesService,
    AlertsService,
  ],
  exports: [AlertRulesService, AlertsService],
})
export class AlertsModule {}
