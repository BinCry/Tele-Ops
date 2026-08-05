import { Module } from '@nestjs/common';
import { MonitoringModule } from 'src/modules/monitoring/monitoring.module';
import { DeploymentService } from './deployment.service';
import { DeployTargetsService } from './deploy-targets.service';
import { SafeProcessRunner } from './safe-process-runner.service';

@Module({
  imports: [MonitoringModule],
  providers: [DeployTargetsService, SafeProcessRunner, DeploymentService],
  exports: [DeployTargetsService, DeploymentService],
})
export class DeployModule {}
