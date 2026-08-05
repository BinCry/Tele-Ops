import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { AlertRulesService } from './alert-rules.service';

describe('AlertRulesService', () => {
  const tempDirectory = join(process.cwd(), '.tmp', 'alert-rule-tests');
  const configPath = join(tempDirectory, 'alert-rules.yaml');

  beforeEach(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
    await mkdir(tempDirectory, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it('returns configured alert rules from yaml', async () => {
    await writeFile(
      configPath,
      [
        'rules:',
        '  - name: teleops-http-down',
        '    displayName: TeleOps HTTP Down',
        '    targetName: teleops-http',
        '    severity: critical',
        '    triggerOnStatuses:',
        '      - DOWN',
        '    responseTimeMsAbove: 1500',
        '    cooldownMinutes: 10',
        '    enabled: true',
      ].join('\n'),
      'utf8',
    );

    const service = new AlertRulesService({
      get: jest.fn().mockReturnValue(configPath),
    } as unknown as ConfigService);

    await expect(service.getOverview()).resolves.toEqual({
      configPath,
      fileExists: true,
      enabledRuleCount: 1,
      disabledRuleCount: 0,
      rules: [
        {
          name: 'teleops-http-down',
          displayName: 'TeleOps HTTP Down',
          targetName: 'teleops-http',
          severity: 'critical',
          triggerOnStatuses: ['DOWN'],
          responseTimeMsAbove: 1500,
          cooldownMinutes: 10,
          enabled: true,
        },
      ],
    });
  });
});
