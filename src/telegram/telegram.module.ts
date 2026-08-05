import { Module } from '@nestjs/common';
import { TelegramRateLimitService } from 'src/common/rate-limit/telegram-rate-limit.service';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AuditModule } from 'src/modules/audit/audit.module';
import { DashboardModule } from 'src/modules/dashboard/dashboard.module';
import { RbacModule } from 'src/modules/rbac/rbac.module';
import { ServerModule } from 'src/modules/server/server.module';
import { TelegramNavigationService } from './navigation/navigation.service';
import { TelegramMenuRenderer } from './renderers/menu-renderer.service';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';

@Module({
  imports: [AuthModule, AuditModule, RbacModule, ServerModule, DashboardModule],
  providers: [
    TelegramRateLimitService,
    TelegramMenuRenderer,
    TelegramNavigationService,
    TelegramService,
    TelegramUpdate,
  ],
})
export class TelegramModule {}
