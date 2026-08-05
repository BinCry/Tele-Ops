import { ConfigService } from '@nestjs/config';
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

    const service = new DockerService(gateway, configService);

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

        if (key === 'security.dangerousActionsEnabled') {
          return true;
        }

        return [];
      }),
    } as unknown as ConfigService;

    const service = new DockerService(gateway, configService);

    await expect(
      service.executeAction('1234567890ab', 'restart'),
    ).resolves.toEqual(
      expect.objectContaining({
        name: 'teleops-app',
        shortId: '1234567890ab',
      }),
    );
  });
});
