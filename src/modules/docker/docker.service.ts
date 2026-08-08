import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from 'src/modules/settings/settings.service';
import {
  DockerContainerSummary,
  DockerGateway,
  DockerManagedAction,
} from './docker.gateway';

export type DockerOverview = {
  containers: DockerContainerSummary[];
  restricted: boolean;
};

export type DockerLogsSnapshot = {
  containerShortId: string;
  containerName: string;
  lines: string[];
};

export type DockerActionTarget = DockerContainerSummary & {
  shortId: string;
  availableActions: DockerManagedAction[];
};

export type DockerLogTarget = DockerContainerSummary & {
  shortId: string;
};

@Injectable()
export class DockerService {
  constructor(
    private readonly dockerGateway: DockerGateway,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
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

  async getRecentLogs(
    containerShortId?: string,
  ): Promise<DockerLogsSnapshot | null> {
    const overview = await this.getOverview();
    const preferredContainer = containerShortId
      ? overview.containers.find(
          (container) => container.id.slice(0, 12) === containerShortId,
        )
      : overview.containers.find((container) => container.state === 'running') ??
        overview.containers[0];

    if (!preferredContainer) {
      return null;
    }

    const lines = await this.dockerGateway.getRecentLogs(preferredContainer.id);

    return {
      containerShortId: preferredContainer.id.slice(0, 12),
      containerName: preferredContainer.name,
      lines: lines.slice(-20),
    };
  }

  async getLogTargets(): Promise<DockerLogTarget[]> {
    const overview = await this.getOverview();

    return overview.containers.map((container) => ({
      ...container,
      shortId: container.id.slice(0, 12),
    }));
  }

  async getDangerousActionsEnabled(): Promise<boolean> {
    return this.settingsService.getDangerousActionsEnabled();
  }

  async getActionTargets(): Promise<DockerActionTarget[]> {
    const overview = await this.getOverview();

    return overview.containers.map((container) => ({
      ...container,
      shortId: container.id.slice(0, 12),
      availableActions:
        container.state === 'running'
          ? ['restart', 'stop']
          : container.state === 'exited' || container.state === 'created'
            ? ['start', 'remove']
            : ['remove'],
    }));
  }

  async executeAction(
    containerShortId: string,
    action: DockerManagedAction,
  ): Promise<DockerActionTarget> {
    if (!(await this.getDangerousActionsEnabled())) {
      throw new Error('Dangerous Docker actions are disabled.');
    }

    const target = await this.findActionTarget(containerShortId);

    if (!target.availableActions.includes(action)) {
      throw new Error(
        `Action ${action} is not available for container ${target.name}.`,
      );
    }

    switch (action) {
      case 'start':
        await this.dockerGateway.startContainer(target.id);
        break;
      case 'stop':
        await this.dockerGateway.stopContainer(target.id);
        break;
      case 'restart':
        await this.dockerGateway.restartContainer(target.id);
        break;
      case 'remove':
        await this.dockerGateway.removeContainer(target.id);
        break;
    }

    return target;
  }

  async findActionTarget(
    containerShortId: string,
  ): Promise<DockerActionTarget> {
    const targets = await this.getActionTargets();
    const target = targets.find(
      (container) => container.shortId === containerShortId,
    );

    if (!target) {
      throw new Error('Container is missing or not allowed.');
    }

    return target;
  }
}
