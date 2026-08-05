import { Module } from '@nestjs/common';
import { HttpHealthGateway } from './http-health.gateway';
import { HealthTargetsService } from './health-targets.service';
import { MonitoringService } from './monitoring.service';

@Module({
  providers: [HttpHealthGateway, HealthTargetsService, MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
