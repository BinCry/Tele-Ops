import { ConfigService } from '@nestjs/config';
import { SettingsService } from 'src/modules/settings/settings.service';
import { DockerGateway } from './docker.gateway';
import { DockerService } from './docker.service';

describe('DockerService', () => {
  it('filters containers by allowlist when configured', async () => {
    const gateway = {
      listContainers: jest.fn().mockResolvedValue([
        {
          id: '1',
          name: 'teleops-app',
          image: 'teleops:latest',
          state: 'running',
          status: 'Up 5m',
        },
        {
          id: '2',
          name: 'db',
          image: 'postgres:17',
          state: 'running',
          status: 'Up 5m',
        },
      ]),
    } as unknown as DockerGateway;

    const configService = {
      get: jest.fn(() => ['teleops-app']),
    } as unknown as ConfigService;

    const service = new DockerService(gateway, configService, {
      getDangerousActionsEnabled: jest.fn().mockResolvedValue(false),
    } as unknown as SettingsService);

    await expect(service.getOverview()).resolves.toEqual({
      containers: [
        {
          id: '1',
          name: 'teleops-app',
          image: 'teleops:latest',
          state: 'running',
          status: 'Up 5m',
        },
      ],
      restricted: true,
    });
  });

  it('executes restart only when dangerous actions are enabled', async () => {
    const gateway = {
      listContainers: jest.fn().mockResolvedValue([
        {
          id: '1234567890ab',
          name: 'teleops-app',
          image: 'teleops:latest',
          state: 'running',
          status: 'Up 5m',
        },
      ]),
      restartContainer: jest.fn().mockResolvedValue(undefined),
    } as unknown as DockerGateway;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'allowlists.containers') {
          return [];
        }

        return [];
      }),
    } as unknown as ConfigService;

    const service = new DockerService(gateway, configService, {
      getDangerousActionsEnabled: jest.fn().mockResolvedValue(true),
    } as unknown as SettingsService);

    await expect(
      service.executeAction('1234567890ab', 'restart'),
    ).resolves.toEqual(
      expect.objectContaining({
        name: 'teleops-app',
        shortId: '1234567890ab',
      }),
    );
  });

  it('allows removing an exited container when dangerous actions are enabled', async () => {
    const gateway = {
      listContainers: jest.fn().mockResolvedValue([
        {
          id: 'abcdef123456',
          name: 'teleops-old',
          image: 'teleops:old',
          state: 'exited',
          status: 'Exited (0) 2 hours ago',
        },
      ]),
      removeContainer: jest.fn().mockResolvedValue(undefined),
    } as unknown as DockerGateway;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'allowlists.containers') {
          return [];
        }

        return [];
      }),
    } as unknown as ConfigService;

    const service = new DockerService(gateway, configService, {
      getDangerousActionsEnabled: jest.fn().mockResolvedValue(true),
    } as unknown as SettingsService);

    await expect(
      service.executeAction('abcdef123456', 'remove'),
    ).resolves.toEqual(
      expect.objectContaining({
        name: 'teleops-old',
        shortId: 'abcdef123456',
      }),
    );
  });

  it('returns logs for a selected container by short id', async () => {
    const gateway = {
      listContainers: jest.fn().mockResolvedValue([
        {
          id: '1234567890abcdef',
          name: 'teleops-app',
          image: 'teleops:latest',
          state: 'running',
          status: 'Up 5m',
        },
      ]),
      getRecentLogs: jest
        .fn()
        .mockResolvedValue(['line 1', 'line 2', 'line 3', 'line 4']),
    } as unknown as DockerGateway;

    const configService = {
      get: jest.fn(() => []),
    } as unknown as ConfigService;

    const service = new DockerService(gateway, configService, {
      getDangerousActionsEnabled: jest.fn().mockResolvedValue(true),
    } as unknown as SettingsService);

    await expect(service.getRecentLogs('1234567890ab')).resolves.toEqual({
      containerShortId: '1234567890ab',
      containerName: 'teleops-app',
      lines: ['line 1', 'line 2', 'line 3', 'line 4'],
    });
  });
});
