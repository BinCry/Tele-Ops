import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule, Params } from 'nestjs-pino';
import { DatabaseModule } from './database/database.module';
import { configuration } from './config/configuration';
import { validateEnvironment } from './config/env.schema';
import { AuditModule } from './modules/audit/audit.module';
import { ActionRequestModule } from './modules/action-request/action-request.module';
import { AuthModule } from './modules/auth/auth.module';
import { BackupModule } from './modules/backup/backup.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DeployModule } from './modules/deploy/deploy.module';
import { DockerModule } from './modules/docker/docker.module';
import { HealthModule } from './modules/health/health.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { ServerModule } from './modules/server/server.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { TelegramModule } from './telegram/telegram.module';

const loggerConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
      censor: '[REDACTED]',
    },
    ...(process.env.NODE_ENV === 'production'
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:standard',
            },
          },
        }),
  },
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
      load: [configuration],
    }),
    LoggerModule.forRoot(loggerConfig),
    DatabaseModule,
    UsersModule,
    RbacModule,
    ActionRequestModule,
    AuditModule,
    AuthModule,
    BackupModule,
    ServerModule,
    DashboardModule,
    DeployModule,
    DockerModule,
    HealthModule,
    SettingsModule,
    TelegramModule,
  ],
})
export class AppModule {}
