import { Module } from '@nestjs/common';
import { DockerGateway } from './docker.gateway';
import { DockerService } from './docker.service';

@Module({
  providers: [DockerGateway, DockerService],
  exports: [DockerService],
})
export class DockerModule {}
