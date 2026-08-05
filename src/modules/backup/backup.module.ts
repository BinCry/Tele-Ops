import { Module } from '@nestjs/common';
import { PostgresBackupGateway } from './postgres-backup.gateway';
import { BackupService } from './backup.service';

@Module({
  providers: [PostgresBackupGateway, BackupService],
  exports: [BackupService],
})
export class BackupModule {}
