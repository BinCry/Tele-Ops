import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { DeployTargetsService } from './deploy-targets.service';

describe('DeployTargetsService', () => {
  const tempDirectory = join(process.cwd(), '.tmp', 'deploy-target-tests');
  const configPath = join(tempDirectory, 'deploy-targets.yaml');

  beforeEach(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
    await mkdir(tempDirectory, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it('returns configured targets from yaml', async () => {
    await writeFile(
      configPath,
      [
        'targets:',
        '  - name: teleops-prod',
        '    displayName: TeleOps Production',
        '    workingDirectory: /opt/teleops',
        '    repositoryUrl: https://github.com/BinCry/Tele-Ops.git',
        '    branch: main',
        '    composeFile: docker-compose.production.yml',
        '    composeProject: teleops',
        '    healthTargetName: teleops-http',
        '    enabled: true',
      ].join('\n'),
      'utf8',
    );

    const service = new DeployTargetsService({
      get: jest.fn().mockReturnValue(configPath),
    } as unknown as ConfigService);

    await expect(service.getOverview()).resolves.toEqual({
      configPath,
      fileExists: true,
      enabledTargetCount: 1,
      disabledTargetCount: 0,
      targets: [
        {
          name: 'teleops-prod',
          displayName: 'TeleOps Production',
          workingDirectory: '/opt/teleops',
          repositoryUrl: 'https://github.com/BinCry/Tele-Ops.git',
          branch: 'main',
          composeFile: 'docker-compose.production.yml',
          composeProject: 'teleops',
          healthTargetName: 'teleops-http',
          enabled: true,
        },
      ],
    });
  });

  it('degrades gracefully when the config file is missing', async () => {
    const service = new DeployTargetsService({
      get: jest.fn().mockReturnValue(configPath),
    } as unknown as ConfigService);

    await expect(service.getOverview()).resolves.toEqual({
      configPath,
      fileExists: false,
      enabledTargetCount: 0,
      disabledTargetCount: 0,
      targets: [],
    });
  });
});
