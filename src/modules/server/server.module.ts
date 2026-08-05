import { Module } from '@nestjs/common';
import { ServerService } from './server.service';
import { SystemMetricsGateway } from './system-metrics.gateway';

@Module({
  providers: [SystemMetricsGateway, ServerService],
  exports: [ServerService],
})
export class ServerModule {}
