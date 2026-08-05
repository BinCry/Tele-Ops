import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/database/prisma.service';

const SETTING_KEYS = {
  confirmationTtlSeconds: 'security.confirmationTtlSeconds',
  dangerousActionsEnabled: 'security.dangerousActionsEnabled',
} as const;

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
    const [
      containerAllowlist,
      composeAllowlist,
      persistedSettingCount,
      dangerousActionsEnabled,
      confirmationTtlSeconds,
    ] = await Promise.all([
      Promise.resolve(
        this.configService.get<string[]>('allowlists.containers', []),
      ),
      Promise.resolve(
        this.configService.get<string[]>('allowlists.composeProjects', []),
      ),
      this.prismaService.setting.count(),
      this.getDangerousActionsEnabled(),
      this.getConfirmationTtlSeconds(),
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
      dangerousActionsEnabled,
      confirmationTtlSeconds,
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

  async getDangerousActionsEnabled(): Promise<boolean> {
    const fallback = this.configService.get<boolean>(
      'security.dangerousActionsEnabled',
      false,
    );
    const override = await this.prismaService.setting.findUnique({
      where: {
        key: SETTING_KEYS.dangerousActionsEnabled,
      },
      select: {
        valueJson: true,
      },
    });

    return typeof override?.valueJson === 'boolean'
      ? override.valueJson
      : fallback;
  }

  async setDangerousActionsEnabled(enabled: boolean): Promise<void> {
    await this.prismaService.setting.upsert({
      where: {
        key: SETTING_KEYS.dangerousActionsEnabled,
      },
      update: {
        valueJson: enabled,
      },
      create: {
        key: SETTING_KEYS.dangerousActionsEnabled,
        valueJson: enabled,
      },
    });
  }

  async getConfirmationTtlSeconds(): Promise<number> {
    const fallback = this.configService.get<number>(
      'security.confirmationTtlSeconds',
      60,
    );
    const override = await this.prismaService.setting.findUnique({
      where: {
        key: SETTING_KEYS.confirmationTtlSeconds,
      },
      select: {
        valueJson: true,
      },
    });

    return typeof override?.valueJson === 'number' &&
      Number.isInteger(override.valueJson)
      ? override.valueJson
      : fallback;
  }

  async setConfirmationTtlSeconds(seconds: number): Promise<void> {
    if (!Number.isInteger(seconds) || seconds < 30 || seconds > 600) {
      throw new Error(
        'Confirmation TTL must be an integer between 30 and 600 seconds.',
      );
    }

    await this.prismaService.setting.upsert({
      where: {
        key: SETTING_KEYS.confirmationTtlSeconds,
      },
      update: {
        valueJson: seconds,
      },
      create: {
        key: SETTING_KEYS.confirmationTtlSeconds,
        valueJson: seconds,
      },
    });
  }
}
