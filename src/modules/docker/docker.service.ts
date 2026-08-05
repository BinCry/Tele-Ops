import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerContainerSummary, DockerGateway } from './docker.gateway';

export type DockerOverview = {
  containers: DockerContainerSummary[];
  restricted: boolean;
};

export type DockerLogsSnapshot = {
  containerName: string;
  lines: string[];
};

@Injectable()
export class DockerService {
  constructor(
    private readonly dockerGateway: DockerGateway,
    private readonly configService: ConfigService,
  ) {}

  async getOverview(): Promise<DockerOverview> {
    const containers = await this.dockerGateway.listContainers();
    const allowlist = this.configService.get<string[]>(
      'allowlists.containers',
      [],
    );

    if (allowlist.length === 0) {
      return {
        containers,
        restricted: false,
      };
    }

    return {
      containers: containers.filter((container) =>
        allowlist.includes(container.name),
      ),
      restricted: true,
    };
  }

  async getRecentLogs(): Promise<DockerLogsSnapshot | null> {
    const overview = await this.getOverview();
    const preferredContainer =
      overview.containers.find((container) => container.state === 'running') ??
      overview.containers[0];

    if (!preferredContainer) {
      return null;
    }

    const lines = await this.dockerGateway.getRecentLogs(preferredContainer.id);

    return {
      containerName: preferredContainer.name,
      lines: lines.slice(-20),
    };
  }
}
