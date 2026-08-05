import { Module } from '@nestjs/common';
import { DeployTargetsService } from './deploy-targets.service';

@Module({
  providers: [DeployTargetsService],
  exports: [DeployTargetsService],
})
export class DeployModule {}
