import { Module } from '@nestjs/common';
import { DeploymentService } from './deployment.service';
import { DeployTargetsService } from './deploy-targets.service';
import { SafeProcessRunner } from './safe-process-runner.service';

@Module({
  providers: [DeployTargetsService, SafeProcessRunner, DeploymentService],
  exports: [DeployTargetsService, DeploymentService],
})
export class DeployModule {}
