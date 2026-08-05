import { Module } from '@nestjs/common';
import { ServerModule } from '../server/server.module';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ServerModule],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
