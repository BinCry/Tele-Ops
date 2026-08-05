import { readFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckStatus } from '@prisma/client';
import yaml from 'js-yaml';
import { z } from 'zod';

const alertSeveritySchema = z.enum(['info', 'warning', 'critical']);

const alertRuleSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,64}$/),
  displayName: z.string().trim().min(1),
  targetName: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,32}$/),
  severity: alertSeveritySchema.default('warning'),
  triggerOnStatuses: z.array(z.nativeEnum(HealthCheckStatus)).default([]),
  responseTimeMsAbove: z.number().int().min(1).optional(),
  cooldownMinutes: z.number().int().min(1).max(1440).default(15),
  enabled: z.boolean().default(true),
});

const alertRulesConfigSchema = z.object({
  rules: z.array(alertRuleSchema).default([]),
});

export type AlertRuleSummary = z.infer<typeof alertRuleSchema>;

export type AlertRulesOverview = {
  configPath: string;
  fileExists: boolean;
  enabledRuleCount: number;
  disabledRuleCount: number;
  rules: AlertRuleSummary[];
};

@Injectable()
export class AlertRulesService {
  constructor(private readonly configService: ConfigService) {}

  async getOverview(): Promise<AlertRulesOverview> {
    const config = await this.loadConfig();

    return {
      configPath: config.configPath,
      fileExists: config.fileExists,
      enabledRuleCount: config.rules.filter((rule) => rule.enabled).length,
      disabledRuleCount: config.rules.filter((rule) => !rule.enabled).length,
      rules: config.rules,
    };
  }

  private async loadConfig(): Promise<{
    configPath: string;
    fileExists: boolean;
    rules: AlertRuleSummary[];
  }> {
    const configPath = this.configService.get<string>(
      'paths.alertRulesConfig',
      '/app/config/alert-rules.yaml',
    );

    try {
      const rawContent = await readFile(configPath, 'utf8');
      const parsedYaml = yaml.load(rawContent);
      const parsedConfig = alertRulesConfigSchema.parse(parsedYaml);
      const rules = [...parsedConfig.rules].sort((left, right) =>
        left.displayName.localeCompare(right.displayName),
      );

      return {
        configPath,
        fileExists: true,
        rules,
      };
    } catch (error) {
      if (isMissingFileError(error)) {
        return {
          configPath,
          fileExists: false,
          rules: [],
        };
      }

      throw error;
    }
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
