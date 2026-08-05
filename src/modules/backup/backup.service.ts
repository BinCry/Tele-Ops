import { createHash } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { access, mkdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BackupStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { PostgresBackupGateway } from './postgres-backup.gateway';

export type DatabaseStatusSnapshot = {
  host: string;
  databaseName: string;
  reachable: boolean;
  error?: string;
};

export type BackupRecordSummary = {
  filename: string;
  status: BackupStatus;
  finishedAt: Date | null;
  sizeBytes: bigint | null;
  errorMessage: string | null;
};

export type BackupOverviewSnapshot = {
  enabled: boolean;
  backupDirectory: string;
  directoryAccessible: boolean;
  maxTelegramSizeMb: number;
  pgDumpAvailable: boolean;
  pgDumpVersion?: string;
  latestBackup: BackupRecordSummary | null;
};

export type BackupExecutionResult = {
  filename: string;
  storagePath: string;
  checksumSha256: string;
  sizeBytes: bigint;
};

@Injectable()
export class BackupService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly postgresBackupGateway: PostgresBackupGateway,
  ) {}

  async getDatabaseStatus(): Promise<DatabaseStatusSnapshot> {
    const databaseUrl = this.configService.getOrThrow<string>('DATABASE_URL');
    const parsedUrl = new URL(databaseUrl);

    try {
      await this.prismaService.$queryRawUnsafe('SELECT 1');

      return {
        host: formatHost(parsedUrl),
        databaseName: parsedUrl.pathname.replace(/^\//, ''),
        reachable: true,
      };
    } catch (error) {
      return {
        host: formatHost(parsedUrl),
        databaseName: parsedUrl.pathname.replace(/^\//, ''),
        reachable: false,
        error:
          error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  async getBackupOverview(): Promise<BackupOverviewSnapshot> {
    const backupDirectory = this.configService.get<string>(
      'paths.backupDirectory',
      '/data/backups',
    );
    const latestBackup = await this.prismaService.backupRecord.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    });
    const [directoryAccessible, pgDumpVersion] = await Promise.all([
      this.isDirectoryAccessible(backupDirectory),
      this.postgresBackupGateway.getPgDumpVersion(),
    ]);

    const overview: BackupOverviewSnapshot = {
      enabled: this.configService.get<boolean>('DATABASE_BACKUP_ENABLED', true),
      backupDirectory,
      directoryAccessible,
      maxTelegramSizeMb: this.configService.get<number>(
        'BACKUP_MAX_TELEGRAM_SIZE_MB',
        20,
      ),
      pgDumpAvailable: pgDumpVersion !== null,
      latestBackup: latestBackup
        ? {
            filename: latestBackup.filename,
            status: latestBackup.status,
            finishedAt: latestBackup.finishedAt,
            sizeBytes: latestBackup.sizeBytes,
            errorMessage: latestBackup.errorMessage,
          }
        : null,
    };

    if (pgDumpVersion) {
      overview.pgDumpVersion = pgDumpVersion;
    }

    return overview;
  }

  async createBackup(triggeredById?: string): Promise<BackupExecutionResult> {
    if (!this.configService.get<boolean>('DATABASE_BACKUP_ENABLED', true)) {
      throw new Error('Database backup is disabled.');
    }

    const databaseUrl = this.configService.getOrThrow<string>('DATABASE_URL');
    const backupDirectory = this.configService.get<string>(
      'paths.backupDirectory',
      '/data/backups',
    );
    const filename = buildBackupFilename();
    const storagePath = join(backupDirectory, filename);

    await mkdir(backupDirectory, { recursive: true });

    const record = await this.prismaService.backupRecord.create({
      data: {
        triggeredById: triggeredById ?? null,
        filename,
        storagePath,
        status: BackupStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      await this.postgresBackupGateway.createBackup(databaseUrl, storagePath);

      const fileStat = await stat(storagePath);
      const checksumSha256 = await computeSha256(storagePath);
      const sizeBytes = BigInt(fileStat.size);

      await this.prismaService.backupRecord.update({
        where: {
          id: record.id,
        },
        data: {
          status: BackupStatus.SUCCESS,
          checksumSha256,
          sizeBytes,
          finishedAt: new Date(),
        },
      });
      await this.pruneExpiredBackups();

      return {
        filename,
        storagePath,
        checksumSha256,
        sizeBytes,
      };
    } catch (error) {
      await unlink(storagePath).catch(() => undefined);
      await this.prismaService.backupRecord.update({
        where: {
          id: record.id,
        },
        data: {
          status: BackupStatus.FAILED,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown backup error',
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async pruneExpiredBackups(): Promise<void> {
    const retentionDays = this.configService.get<number>(
      'BACKUP_RETENTION_DAYS',
      7,
    );
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    const expiredRecords = await this.prismaService.backupRecord.findMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
      },
      select: {
        id: true,
        storagePath: true,
      },
    });

    if (expiredRecords.length === 0) {
      return;
    }

    await Promise.all(
      expiredRecords.map((record) =>
        unlink(record.storagePath).catch(() => undefined),
      ),
    );
    await this.prismaService.backupRecord.deleteMany({
      where: {
        id: {
          in: expiredRecords.map((record) => record.id),
        },
      },
    });
  }

  private async isDirectoryAccessible(path: string): Promise<boolean> {
    try {
      await access(path, constants.R_OK | constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}

function formatHost(databaseUrl: URL): string {
  return databaseUrl.port.length > 0
    ? `${databaseUrl.hostname}:${databaseUrl.port}`
    : databaseUrl.hostname;
}

function buildBackupFilename(): string {
  const now = new Date();
  const parts = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    '-',
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ];

  return `teleops-${parts.join('')}.sql`;
}

async function computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk as Buffer);
    });
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
    stream.on('error', reject);
  });
}
