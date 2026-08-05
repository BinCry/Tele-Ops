import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';

export type DockerContainerSummary = {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
};

export type DockerManagedAction = 'start' | 'stop' | 'restart';

@Injectable()
export class DockerGateway {
  private readonly client: Docker;

  constructor(configService: ConfigService) {
    const dockerHost = configService.get<string>(
      'DOCKER_HOST',
      'unix:///var/run/docker.sock',
    );

    this.client = new Docker(resolveDockerConnection(dockerHost));
  }

  async listContainers(): Promise<DockerContainerSummary[]> {
    const containers = await this.client.listContainers({
      all: true,
    });

    return containers.map((container) => ({
      id: container.Id,
      name: normalizeContainerName(container.Names[0] ?? container.Id),
      image: container.Image,
      state: container.State,
      status: container.Status,
    }));
  }

  async getRecentLogs(containerId: string, tail = 40): Promise<string[]> {
    const container = this.client.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: false,
    });

    return logs
      .toString('utf8')
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
  }

  async startContainer(containerId: string): Promise<void> {
    const container = this.client.getContainer(containerId);
    await container.start();
  }

  async stopContainer(containerId: string): Promise<void> {
    const container = this.client.getContainer(containerId);
    await container.stop({
      t: 10,
    });
  }

  async restartContainer(containerId: string): Promise<void> {
    const container = this.client.getContainer(containerId);
    await container.restart({
      t: 10,
    });
  }
}

function resolveDockerConnection(dockerHost: string): Docker.DockerOptions {
  if (dockerHost.startsWith('unix://')) {
    return {
      socketPath: dockerHost.replace('unix://', ''),
    };
  }

  if (dockerHost.startsWith('npipe://')) {
    return {
      socketPath: dockerHost.replace('npipe://', ''),
    };
  }

  const url = new URL(dockerHost);
  const protocol = url.protocol.replace(':', '');

  return {
    protocol: protocol as 'http' | 'https' | 'ssh',
    host: url.hostname,
    port: Number(url.port),
  };
}

function normalizeContainerName(name: string): string {
  return name.startsWith('/') ? name.slice(1) : name;
}
