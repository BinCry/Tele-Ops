import { ConfigService } from '@nestjs/config';
import { BackupStatus } from '@prisma/client';
import { BackupService } from './backup.service';

describe('BackupService', () => {
  let prismaService: {
    $queryRawUnsafe: jest.Mock;
    backupRecord: {
      findFirst: jest.Mock;
    };
  };
  let configService: {
    get: jest.Mock;
    getOrThrow: jest.Mock;
  };
  let backupService: BackupService;

  beforeEach(() => {
    prismaService = {
      $queryRawUnsafe: jest.fn(),
      backupRecord: {
        findFirst: jest.fn(),
      },
    };
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        switch (key) {
          case 'paths.backupDirectory':
            return 'D:/Tele-Ops/.tmp/backups';
          case 'DATABASE_BACKUP_ENABLED':
            return true;
          case 'BACKUP_MAX_TELEGRAM_SIZE_MB':
            return 20;
          default:
            return fallback;
        }
      }),
      getOrThrow: jest
        .fn()
        .mockReturnValue('postgresql://teleops:teleops@db:5432/teleops'),
    };

    backupService = new BackupService(
      prismaService as never,
      configService as unknown as ConfigService,
    );
  });

  it('returns a reachable database snapshot when the probe succeeds', async () => {
    prismaService.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);

    await expect(backupService.getDatabaseStatus()).resolves.toEqual({
      host: 'db:5432',
      databaseName: 'teleops',
      reachable: true,
    });
  });

  it('returns a failed database snapshot when the probe throws', async () => {
    prismaService.$queryRawUnsafe.mockRejectedValue(new Error('db down'));

    await expect(backupService.getDatabaseStatus()).resolves.toEqual({
      host: 'db:5432',
      databaseName: 'teleops',
      reachable: false,
      error: 'db down',
    });
  });

  it('includes the latest backup record in the overview', async () => {
    prismaService.backupRecord.findFirst.mockResolvedValue({
      filename: 'backup.sql.gz',
      status: BackupStatus.SUCCESS,
      finishedAt: new Date('2026-08-05T10:00:00.000Z'),
      sizeBytes: BigInt(4096),
      errorMessage: null,
    });

    const overview = await backupService.getBackupOverview();

    expect(overview.enabled).toBe(true);
    expect(overview.backupDirectory).toBe('D:/Tele-Ops/.tmp/backups');
    expect(overview.maxTelegramSizeMb).toBe(20);
    expect(overview.latestBackup).toEqual({
      filename: 'backup.sql.gz',
      status: BackupStatus.SUCCESS,
      finishedAt: new Date('2026-08-05T10:00:00.000Z'),
      sizeBytes: BigInt(4096),
      errorMessage: null,
    });
  });
});
