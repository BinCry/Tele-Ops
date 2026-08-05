import { ConfigService } from '@nestjs/config';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  it('builds a settings snapshot from config and persistence state', async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        switch (key) {
          case 'allowlists.containers':
            return ['teleops', 'postgres'];
          case 'allowlists.composeProjects':
            return ['teleops'];
          case 'app.name':
            return 'TeleOps';
          case 'app.environment':
            return 'production';
          case 'app.timezone':
            return 'Asia/Ho_Chi_Minh';
          case 'security.dangerousActionsEnabled':
            return true;
          case 'security.confirmationTtlSeconds':
            return 120;
          case 'security.actionRateLimitPerMinute':
            return 30;
          case 'security.encryptionKeyConfigured':
            return true;
          case 'paths.backupDirectory':
            return '/data/backups';
          default:
            return fallback;
        }
      }),
    };
    const prismaService = {
      setting: {
        count: jest.fn().mockResolvedValue(4),
      },
    };

    const settingsService = new SettingsService(
      configService as unknown as ConfigService,
      prismaService as never,
    );

    await expect(settingsService.getSettingsSnapshot()).resolves.toEqual({
      appName: 'TeleOps',
      environment: 'production',
      timezone: 'Asia/Ho_Chi_Minh',
      dangerousActionsEnabled: true,
      confirmationTtlSeconds: 120,
      actionRateLimitPerMinute: 30,
      encryptionKeyConfigured: true,
      backupDirectory: '/data/backups',
      containerAllowlistCount: 2,
      composeAllowlistCount: 1,
      persistedSettingCount: 4,
    });
  });
});
