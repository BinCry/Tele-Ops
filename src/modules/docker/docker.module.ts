import { Module } from '@nestjs/common';
import { SettingsModule } from 'src/modules/settings/settings.module';
import { DockerGateway } from './docker.gateway';
import { DockerService } from './docker.service';

@Module({
  imports: [SettingsModule],
  providers: [DockerGateway, DockerService],
  exports: [DockerService],
})
export class DockerModule {}
