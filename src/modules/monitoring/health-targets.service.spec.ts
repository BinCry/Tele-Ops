import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { HealthTargetsService } from './health-targets.service';

describe('HealthTargetsService', () => {
  const tempDirectory = join(process.cwd(), '.tmp', 'health-target-tests');
  const configPath = join(tempDirectory, 'health-targets.yaml');

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
        '  - name: teleops-http',
        '    displayName: TeleOps HTTP',
        '    url: https://teleops.example.com/health',
        '    method: GET',
        '    expectedStatus: 200',
        '    timeoutMs: 4000',
        '    enabled: true',
      ].join('\n'),
      'utf8',
    );

    const service = new HealthTargetsService({
      get: jest.fn().mockReturnValue(configPath),
    } as unknown as ConfigService);

    await expect(service.getOverview()).resolves.toEqual({
      configPath,
      fileExists: true,
      enabledTargetCount: 1,
      disabledTargetCount: 0,
      targets: [
        {
          name: 'teleops-http',
          displayName: 'TeleOps HTTP',
          url: 'https://teleops.example.com/health',
          method: 'GET',
          expectedStatus: 200,
          timeoutMs: 4000,
          enabled: true,
        },
      ],
    });
  });

  it('degrades gracefully when the config file is missing', async () => {
    const service = new HealthTargetsService({
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
