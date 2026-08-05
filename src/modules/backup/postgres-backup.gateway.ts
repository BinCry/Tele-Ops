import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

const execFileAsync = promisify(execFile);

@Injectable()
export class PostgresBackupGateway {
  async getPgDumpVersion(): Promise<string | null> {
    try {
      const { stdout, stderr } = await execFileAsync('pg_dump', ['--version']);
      const version = [stdout, stderr]
        .map((value) => value.trim())
        .find((value) => value.length > 0);

      return version ?? null;
    } catch {
      return null;
    }
  }

  async createBackup(databaseUrl: string, outputPath: string): Promise<void> {
    await execFileAsync('pg_dump', [
      `--dbname=${databaseUrl}`,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      `--file=${outputPath}`,
    ]);
  }
}
