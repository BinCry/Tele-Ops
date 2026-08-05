import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/database/prisma.service';

export type SettingsSnapshot = {
  appName: string;
  environment: string;
  timezone: string;
  dangerousActionsEnabled: boolean;
  confirmationTtlSeconds: number;
  actionRateLimitPerMinute: number;
  encryptionKeyConfigured: boolean;
  backupDirectory: string;
  containerAllowlistCount: number;
  composeAllowlistCount: number;
  persistedSettingCount: number;
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async getSettingsSnapshot(): Promise<SettingsSnapshot> {
    const [containerAllowlist, composeAllowlist, persistedSettingCount] =
      await Promise.all([
        Promise.resolve(
          this.configService.get<string[]>('allowlists.containers', []),
        ),
        Promise.resolve(
          this.configService.get<string[]>('allowlists.composeProjects', []),
        ),
        this.prismaService.setting.count(),
      ]);

    return {
      appName: this.configService.get<string>('app.name', 'TeleOps'),
      environment: this.configService.get<string>(
        'app.environment',
        'development',
      ),
      timezone: this.configService.get<string>(
        'app.timezone',
        'Asia/Ho_Chi_Minh',
      ),
      dangerousActionsEnabled: this.configService.get<boolean>(
        'security.dangerousActionsEnabled',
        false,
      ),
      confirmationTtlSeconds: this.configService.get<number>(
        'security.confirmationTtlSeconds',
        60,
      ),
      actionRateLimitPerMinute: this.configService.get<number>(
        'security.actionRateLimitPerMinute',
        20,
      ),
      encryptionKeyConfigured: this.configService.get<boolean>(
        'security.encryptionKeyConfigured',
        false,
      ),
      backupDirectory: this.configService.get<string>(
        'paths.backupDirectory',
        '/data/backups',
      ),
      containerAllowlistCount: containerAllowlist.length,
      composeAllowlistCount: composeAllowlist.length,
      persistedSettingCount,
    };
  }
}
