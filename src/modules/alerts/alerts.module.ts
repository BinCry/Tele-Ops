import { Module } from '@nestjs/common';
import { AlertNotifierService } from './alert-notifier.service';
import { AlertRulesService } from './alert-rules.service';
import { AlertsService } from './alerts.service';

@Module({
  providers: [AlertNotifierService, AlertRulesService, AlertsService],
  exports: [AlertRulesService, AlertsService],
})
export class AlertsModule {}
