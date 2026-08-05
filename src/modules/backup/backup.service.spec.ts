import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { BackupStatus } from '@prisma/client';
import { BackupService } from './backup.service';

describe('BackupService', () => {
  let prismaService: {
    $queryRawUnsafe: jest.Mock;
    backupRecord: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };
  let backupGateway: {
    getPgDumpVersion: jest.Mock<Promise<string | null>, []>;
    createBackup: jest.Mock<Promise<void>, [string, string]>;
  };
  let backupService: BackupService;
  let backupDirectory: string;

  beforeEach(async () => {
    backupDirectory = join(process.cwd(), '.tmp', 'backup-tests');
    await rm(backupDirectory, { recursive: true, force: true });
    await mkdir(backupDirectory, { recursive: true });

    prismaService = {
      $queryRawUnsafe: jest.fn(),
      backupRecord: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
    };
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        switch (key) {
          case 'paths.backupDirectory':
            return backupDirectory;
          case 'DATABASE_BACKUP_ENABLED':
            return true;
          case 'BACKUP_MAX_TELEGRAM_SIZE_MB':
            return 20;
          case 'BACKUP_RETENTION_DAYS':
            return 7;
          default:
            return fallback;
        }
      }),
      getOrThrow: jest
        .fn()
        .mockReturnValue('postgresql://teleops:teleops@db:5432/teleops'),
    };
    backupGateway = {
      getPgDumpVersion: jest
        .fn<Promise<string | null>, []>()
        .mockResolvedValue('pg_dump 17.0'),
      createBackup: jest.fn(
        async (_databaseUrl: string, outputPath: string) => {
          await writeFile(outputPath, 'select 1;\n', 'utf8');
        },
      ),
    };

    backupService = new BackupService(
      prismaService as never,
      configService as unknown as ConfigService,
      backupGateway,
    );
  });

  afterEach(async () => {
    await rm(backupDirectory, { recursive: true, force: true });
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
      filename: 'backup.sql',
      status: BackupStatus.SUCCESS,
      finishedAt: new Date('2026-08-05T10:00:00.000Z'),
      sizeBytes: BigInt(4096),
      errorMessage: null,
    });

    const overview = await backupService.getBackupOverview();

    expect(overview.enabled).toBe(true);
    expect(overview.backupDirectory).toBe(backupDirectory);
    expect(overview.pgDumpAvailable).toBe(true);
    expect(overview.latestBackup).toEqual({
      filename: 'backup.sql',
      status: BackupStatus.SUCCESS,
      finishedAt: new Date('2026-08-05T10:00:00.000Z'),
      sizeBytes: BigInt(4096),
      errorMessage: null,
    });
  });

  it('creates a backup record, file, and checksum', async () => {
    prismaService.backupRecord.create.mockResolvedValue({
      id: 'backup-1',
    });

    const result = await backupService.createBackup('user-1');
    const fileContents = await readFile(result.storagePath, 'utf8');

    expect(result.filename).toContain('teleops-');
    expect(result.checksumSha256).toHaveLength(64);
    expect(fileContents).toContain('select 1;');
    expect(prismaService.backupRecord.update).toHaveBeenCalled();
  });

  it('returns the latest successful backup artifact when Telegram delivery is allowed', async () => {
    const artifactPath = join(backupDirectory, 'latest-backup.sql');
    await writeFile(artifactPath, 'select 1;\n', 'utf8');
    prismaService.backupRecord.findFirst.mockResolvedValue({
      filename: 'latest-backup.sql',
      storagePath: artifactPath,
      checksumSha256: 'b'.repeat(64),
      status: BackupStatus.SUCCESS,
      finishedAt: new Date('2026-08-05T11:00:00.000Z'),
      createdAt: new Date('2026-08-05T11:00:00.000Z'),
    });

    await expect(
      backupService.getLatestSuccessfulBackupArtifactForTelegram(),
    ).resolves.toEqual({
      filename: 'latest-backup.sql',
      storagePath: artifactPath,
      checksumSha256: 'b'.repeat(64),
      sizeBytes: BigInt(10),
    });
  });

  it('rejects latest backup delivery when the artifact exceeds the Telegram size limit', async () => {
    const artifactPath = join(backupDirectory, 'too-large-backup.sql');
    await writeFile(artifactPath, Buffer.alloc(2 * 1024 * 1024, 1));
    configService.get.mockImplementation((key: string, fallback?: unknown) => {
      switch (key) {
        case 'paths.backupDirectory':
          return backupDirectory;
        case 'DATABASE_BACKUP_ENABLED':
          return true;
        case 'BACKUP_MAX_TELEGRAM_SIZE_MB':
          return 1;
        case 'BACKUP_RETENTION_DAYS':
          return 7;
        default:
          return fallback;
      }
    });
    prismaService.backupRecord.findFirst.mockResolvedValue({
      filename: 'too-large-backup.sql',
      storagePath: artifactPath,
      checksumSha256: 'c'.repeat(64),
      status: BackupStatus.SUCCESS,
      finishedAt: new Date('2026-08-05T12:00:00.000Z'),
      createdAt: new Date('2026-08-05T12:00:00.000Z'),
    });

    await expect(
      backupService.getLatestSuccessfulBackupArtifactForTelegram(),
    ).rejects.toThrow('Backup gần nhất vượt giới hạn 1 MB của Telegram.');
  });
});
