import { Module } from '@nestjs/common';
import { TelegramRateLimitService } from 'src/common/rate-limit/telegram-rate-limit.service';
import { ActionRequestModule } from 'src/modules/action-request/action-request.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AuditModule } from 'src/modules/audit/audit.module';
import { BackupModule } from 'src/modules/backup/backup.module';
import { DashboardModule } from 'src/modules/dashboard/dashboard.module';
import { DeployModule } from 'src/modules/deploy/deploy.module';
import { DockerModule } from 'src/modules/docker/docker.module';
import { MonitoringModule } from 'src/modules/monitoring/monitoring.module';
import { RbacModule } from 'src/modules/rbac/rbac.module';
import { ServerModule } from 'src/modules/server/server.module';
import { SettingsModule } from 'src/modules/settings/settings.module';
import { UsersModule } from 'src/modules/users/users.module';
import { TelegramNavigationService } from './navigation/navigation.service';
import { TelegramMenuRenderer } from './renderers/menu-renderer.service';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';

@Module({
  imports: [
    AuthModule,
    ActionRequestModule,
    AuditModule,
    RbacModule,
    BackupModule,
    ServerModule,
    DashboardModule,
    DeployModule,
    DockerModule,
    MonitoringModule,
    UsersModule,
    SettingsModule,
  ],
  providers: [
    TelegramRateLimitService,
    TelegramMenuRenderer,
    TelegramNavigationService,
    TelegramService,
    TelegramUpdate,
  ],
})
export class TelegramModule {}
