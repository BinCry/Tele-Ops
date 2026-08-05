import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BackupStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

const execFileAsync = promisify(execFile);

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

@Injectable()
export class BackupService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
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
    const [directoryAccessible, pgDumpProbe] = await Promise.all([
      this.isDirectoryAccessible(backupDirectory),
      this.getPgDumpProbe(),
    ]);

    const overview: BackupOverviewSnapshot = {
      enabled: this.configService.get<boolean>('DATABASE_BACKUP_ENABLED', true),
      backupDirectory,
      directoryAccessible,
      maxTelegramSizeMb: this.configService.get<number>(
        'BACKUP_MAX_TELEGRAM_SIZE_MB',
        20,
      ),
      pgDumpAvailable: pgDumpProbe.available,
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

    if (pgDumpProbe.version) {
      overview.pgDumpVersion = pgDumpProbe.version;
    }

    return overview;
  }

  private async isDirectoryAccessible(path: string): Promise<boolean> {
    try {
      await access(path, constants.R_OK | constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async getPgDumpProbe(): Promise<{
    available: boolean;
    version?: string;
  }> {
    try {
      const { stdout, stderr } = await execFileAsync('pg_dump', ['--version']);
      const version = [stdout, stderr]
        .map((value) => value.trim())
        .find((value) => value.length > 0);

      if (version) {
        return {
          available: true,
          version,
        };
      }

      return {
        available: true,
      };
    } catch {
      return {
        available: false,
      };
    }
  }
}

function formatHost(databaseUrl: URL): string {
  return databaseUrl.port.length > 0
    ? `${databaseUrl.hostname}:${databaseUrl.port}`
    : databaseUrl.hostname;
}
